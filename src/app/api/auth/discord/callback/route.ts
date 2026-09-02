import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { exchangeCodeForProfile, DiscordApiError } from '@/auth/discordApi'
import { issueSession } from '@/auth/session'
import { getGuildGateway } from '@/identity/guild'
import { resolveDiscordLogin, resolveDiscordLink } from '@/identity/discordLogin'
import {
  findPersonByDiscordId,
  createPersonFromDiscord,
  refreshDiscordProfile,
  findClaimCandidates,
  setDiscordIdentity,
  clearDiscordId,
  markInactive,
  personHasReferences,
} from '@/identity/people'
import { createAuditLog } from '@/utilities/auditLogger'

interface OAuthState {
  link: boolean
  returnUrl: string
  nonce: string
}

function safePath(p: string | undefined, fallback = '/admin'): string {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : fallback
}

/**
 * Discord OAuth callback. Two flows:
 *   link  - attach this Discord account to the logged-in person
 *   login - membership check, find-or-create by Discord ID, issue session
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const fail = (error: string) => NextResponse.redirect(new URL(`/admin/login?error=${error}`, serverUrl))

  if (!code || !stateParam) return fail('discord_auth_failed')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('discord-oauth-state')?.value
  cookieStore.delete('discord-oauth-state')
  if (!storedState || storedState !== stateParam) return fail('invalid_state')

  let state: OAuthState
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return fail('invalid_state')
  }
  const returnUrl = safePath(state.returnUrl)

  let profile
  try {
    profile = await exchangeCodeForProfile(code, `${serverUrl}/api/auth/discord/callback`)
  } catch (err) {
    console.error('[Discord OAuth] exchange failed:', err)
    return fail(err instanceof DiscordApiError ? `discord_${err.code}` : 'discord_request_failed')
  }

  const payload = await getPayload({ config })
  const gateway = await getGuildGateway()

  // ---- link flow ----
  if (state.link) {
    const token = cookieStore.get('payload-token')?.value
    if (!token) return fail('not_authenticated')
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    if (!user) return fail('not_authenticated')

    const member = await gateway.isMember(profile.id)
    if (member === false) return NextResponse.redirect(new URL('/auth/not-a-member', serverUrl))

    const outcome = await resolveDiscordLink(
      {
        findByDiscordId: (id) => findPersonByDiscordId(payload, id),
        hasReferences: (id) => personHasReferences(payload, id),
        setIdentity: (id, p) => setDiscordIdentity(payload, id, p),
        clearDiscordId: (id) => clearDiscordId(payload, id),
        markInactive: (id, into) => markInactive(payload, id, into),
      },
      user.id as number,
      profile,
    )

    if (outcome.kind === 'conflict') {
      const url = new URL(returnUrl, serverUrl)
      url.searchParams.set('error', 'discord_already_linked')
      url.searchParams.set('otherId', String(outcome.otherId))
      return NextResponse.redirect(url)
    }
    if (outcome.kind === 'linked') {
      await createAuditLog(payload, {
        user: user.id as number,
        action: 'update',
        collection: 'people',
        documentId: user.id as number,
        documentTitle: (user as any).name,
        metadata: { identity: 'link-discord', discordId: profile.id, discordUsername: profile.username },
      })
    }
    return NextResponse.redirect(new URL(returnUrl, serverUrl))
  }

  // ---- login flow ----
  const outcome = await resolveDiscordLogin(
    {
      isMember: (id) => gateway.isMember(id),
      findByDiscordId: (id) => findPersonByDiscordId(payload, id),
      createFromDiscord: (p) => createPersonFromDiscord(payload, p),
      refreshProfile: (id, p) => refreshDiscordProfile(payload, id, p),
      findClaimCandidates: (names) => findClaimCandidates(payload, names),
    },
    profile,
  )

  if (outcome.kind === 'not_member') return NextResponse.redirect(new URL('/auth/not-a-member', serverUrl))
  if (outcome.kind === 'membership_unknown') return fail('membership_unavailable')

  const destination =
    outcome.kind === 'created' && outcome.candidates.length > 0
      ? `/claim?returnUrl=${encodeURIComponent(returnUrl)}`
      : returnUrl

  const response = NextResponse.redirect(new URL(destination, serverUrl))
  return issueSession({ payload, person: outcome.person, response, request })
}
