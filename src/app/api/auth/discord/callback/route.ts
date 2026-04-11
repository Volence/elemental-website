import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import type { InviteLink, User } from '@/payload-types'

interface DiscordUser {
  id: string
  username: string
  global_name?: string
  avatar?: string
  discriminator?: string
}

interface OAuthState {
  inviteToken: string
  linkToExisting: boolean
  returnUrl: string
  nonce: string
}

/**
 * Discord OAuth callback endpoint.
 * Handles three flows:
 * 1. Login: Find existing user by discordId, log them in
 * 2. Invite signup: Create new user from invite link, link Discord
 * 3. Link account: Add discordId to currently logged-in user
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/admin/login?error=discord_auth_failed', serverUrl),
    )
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('discord-oauth-state')?.value
  cookieStore.delete('discord-oauth-state')

  if (!storedState || storedState !== stateParam) {
    return NextResponse.redirect(
      new URL('/admin/login?error=invalid_state', serverUrl),
    )
  }

  // Decode state
  let state: OAuthState
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return NextResponse.redirect(
      new URL('/admin/login?error=invalid_state', serverUrl),
    )
  }

  // Exchange code for access token
  const clientId = process.env.DISCORD_CLIENT_ID!
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!
  const redirectUri = `${serverUrl}/api/auth/discord/callback`

  let discordUser: DiscordUser
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('[Discord OAuth] Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(
        new URL('/admin/login?error=discord_token_failed', serverUrl),
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userResponse.ok) {
      console.error('[Discord OAuth] User fetch failed:', await userResponse.text())
      return NextResponse.redirect(
        new URL('/admin/login?error=discord_user_failed', serverUrl),
      )
    }

    discordUser = await userResponse.json()
  } catch (error) {
    console.error('[Discord OAuth] Request failed:', error)
    return NextResponse.redirect(
      new URL('/admin/login?error=discord_request_failed', serverUrl),
    )
  }

  console.log(`[Discord OAuth] Authenticated Discord user: ${discordUser.username} (ID: ${discordUser.id})`)

  const payload = await getPayload({ config })

  // ─── Flow 3: Link Discord to existing account ───
  if (state.linkToExisting) {
    const token = cookieStore.get('payload-token')?.value
    if (!token) {
      console.error('[Discord OAuth] Link flow: no payload-token cookie found')
      return NextResponse.redirect(
        new URL('/admin/login?error=not_authenticated', serverUrl),
      )
    }

    // Verify the token and get current user
    try {
      // Build headers with the cookie for payload.auth()
      const authHeaders = new Headers(request.headers)
      authHeaders.set('Authorization', `JWT ${token}`)
      
      const { user: currentUser } = await payload.auth({ headers: authHeaders })
      if (!currentUser) {
        console.error('[Discord OAuth] Link flow: payload.auth returned no user')
        return NextResponse.redirect(
          new URL('/admin/login?error=not_authenticated', serverUrl),
        )
      }

      console.log(`[Discord OAuth] Link flow: linking Discord ${discordUser.id} to user ${currentUser.id} (${(currentUser as any).email})`)

      // Check if this discordId is already linked to another account
      const existingWithDiscord = await payload.find({
        collection: 'users',
        where: {
          discordId: { equals: discordUser.id },
          id: { not_equals: currentUser.id },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (existingWithDiscord.docs.length > 0) {
        console.warn(`[Discord OAuth] Discord ID ${discordUser.id} already linked to user ${existingWithDiscord.docs[0].id}`)
        return NextResponse.redirect(
          new URL('/admin/login?error=discord_already_linked', serverUrl),
        )
      }

      // Update user with Discord ID
      await payload.update({
        collection: 'users',
        id: currentUser.id,
        data: { discordId: discordUser.id },
        overrideAccess: true,
      })
      console.log(`[Discord OAuth] Successfully linked Discord ${discordUser.id} to user ${currentUser.id}`)

      // Also update linkedPerson's discordId if they have one
      const linkedPerson = (currentUser as User).linkedPerson
      if (linkedPerson) {
        const personId = typeof linkedPerson === 'object' ? linkedPerson.id : linkedPerson
        try {
          await payload.update({
            collection: 'people',
            id: personId,
            data: { discordId: discordUser.id },
            overrideAccess: true,
          })
          console.log(`[Discord OAuth] Also set discordId on linked person ${personId}`)
        } catch (e) {
          console.warn('[Discord OAuth] Could not update person discordId:', e)
        }
      }

      const returnUrl = state.returnUrl || `/admin/collections/users/${currentUser.id}`
      return NextResponse.redirect(
        new URL(returnUrl, serverUrl),
      )
    } catch (error) {
      console.error('[Discord OAuth] Link account failed:', error)
      return NextResponse.redirect(
        new URL('/admin/login?error=link_failed', serverUrl),
      )
    }
  }

  // ─── Flow 2: Invite signup with Discord ───
  if (state.inviteToken) {
    try {
      // Fetch and validate invite
      const invites = await payload.find({
        collection: 'invite-links',
        where: { token: { equals: state.inviteToken } },
        limit: 1,
      })

      const invite = invites.docs[0] as InviteLink | undefined
      if (!invite) {
        return NextResponse.redirect(
          new URL('/admin/login?error=invalid_invite', serverUrl),
        )
      }
      if (invite.usedAt) {
        return NextResponse.redirect(
          new URL('/admin/login?error=invite_used', serverUrl),
        )
      }
      if (new Date(invite.expiresAt) < new Date()) {
        return NextResponse.redirect(
          new URL('/admin/login?error=invite_expired', serverUrl),
        )
      }

      // Check if Discord account already has a user
      const existingUser = await payload.find({
        collection: 'users',
        where: { discordId: { equals: discordUser.id } },
        limit: 1,
      })

      if (existingUser.docs.length > 0) {
        // Already has an account — just log them in
        return await loginAndRedirect(payload, existingUser.docs[0], cookieStore, serverUrl, state.returnUrl)
      }

      // Determine linkedPerson: invite's setting > discordId lookup > create new
      let linkedPersonId: number | undefined
      if (invite.linkedPerson) {
        linkedPersonId = typeof invite.linkedPerson === 'object'
          ? invite.linkedPerson.id
          : invite.linkedPerson as number
      } else {
        // Try to find Person by discordId
        const matchingPeople = await payload.find({
          collection: 'people',
          where: { discordId: { equals: discordUser.id } },
          limit: 1,
        })
        if (matchingPeople.docs.length > 0) {
          linkedPersonId = matchingPeople.docs[0].id
        }
      }

      // If no Person found, create one
      if (!linkedPersonId) {
        const newPerson = await payload.create({
          collection: 'people',
          data: {
            name: discordUser.global_name || discordUser.username,
            discordId: discordUser.id,
          },
          overrideAccess: true,
        })
        linkedPersonId = newPerson.id
      } else {
        // Ensure Person has discordId set
        try {
          await payload.update({
            collection: 'people',
            id: linkedPersonId,
            data: { discordId: discordUser.id },
            overrideAccess: true,
          })
        } catch (e) {
          // Non-critical
        }
      }

      // Find teams this person is on (for auto-assigning assignedTeams)
      let teamIds: number[] = []
      if (invite.assignedTeams && Array.isArray(invite.assignedTeams) && invite.assignedTeams.length > 0) {
        teamIds = invite.assignedTeams.map((t: any) => typeof t === 'object' ? t.id : t)
      } else if (linkedPersonId) {
        // Auto-discover teams from roster
        try {
          const teams = await payload.find({
            collection: 'teams',
            where: {
              'roster.person': { equals: linkedPersonId },
            },
            limit: 50,
          })
          teamIds = teams.docs.map((t) => t.id)
        } catch (e) {
          // Teams query may not support nested filtering — non-critical
        }
      }

      // Create user — Discord users get a random password (they'll always use OAuth)
      const randomPassword = `discord_${Math.random().toString(36).substring(2)}${Date.now()}`
      const newUser = await payload.create({
        collection: 'users',
        data: {
          name: discordUser.global_name || discordUser.username,
          email: `discord_${discordUser.id}@elmt.placeholder`,
          password: randomPassword,
          role: invite.role,
          discordId: discordUser.id,
          linkedPerson: linkedPersonId,
          assignedTeams: teamIds.length > 0 ? teamIds : (invite.assignedTeams ?? undefined),
          departments: {
            isProductionStaff: invite.departments?.isProductionStaff || false,
            isSocialMediaStaff: invite.departments?.isSocialMediaStaff || false,
            isGraphicsStaff: invite.departments?.isGraphicsStaff || false,
            isVideoStaff: invite.departments?.isVideoStaff || false,
            isEventsStaff: invite.departments?.isEventsStaff || false,
            isScoutingStaff: invite.departments?.isScoutingStaff || false,
            isContentCreator: (invite.departments as any)?.isContentCreator || false,
          },
        },
        overrideAccess: true,
      })

      // Mark invite as used
      await payload.update({
        collection: 'invite-links',
        id: invite.id,
        data: {
          usedAt: new Date().toISOString(),
          usedBy: newUser.id,
        },
        overrideAccess: true,
      })

      return await loginAndRedirect(payload, newUser, cookieStore, serverUrl, state.returnUrl)
    } catch (error: any) {
      console.error('[Discord OAuth] Invite signup failed:', error)
      return NextResponse.redirect(
        new URL(`/admin/login?error=signup_failed&message=${encodeURIComponent(error.message || '')}`, serverUrl),
      )
    }
  }

  // ─── Flow 1: Regular login via Discord ───
  try {
    console.log(`[Discord OAuth] Login flow: looking up user with discordId=${discordUser.id}`)
    const existingUser = await payload.find({
      collection: 'users',
      where: { discordId: { equals: discordUser.id } },
      limit: 1,
      overrideAccess: true,
    })

    console.log(`[Discord OAuth] Login flow: found ${existingUser.docs.length} users`)

    if (existingUser.docs.length === 0) {
      return NextResponse.redirect(
        new URL('/admin/login?error=no_account', serverUrl),
      )
    }

    console.log(`[Discord OAuth] Login flow: logging in as ${existingUser.docs[0].email} (user ${existingUser.docs[0].id})`)
    return await loginAndRedirect(payload, existingUser.docs[0], cookieStore, serverUrl, state.returnUrl)
  } catch (error) {
    console.error('[Discord OAuth] Login failed:', error)
    return NextResponse.redirect(
      new URL('/admin/login?error=login_failed', serverUrl),
    )
  }
}

/**
 * Helper: Generate a Payload auth token for the user and redirect.
 * Creates a proper session entry (required by Payload 3's useSessions)
 * and includes the sid in the JWT payload.
 */
async function loginAndRedirect(
  payload: any,
  user: any,
  cookieStore: any,
  serverUrl: string,
  returnUrl: string,
): Promise<NextResponse> {
  const { jwtSign } = await import('payload')
  const { v4: uuid } = await import('uuid')

  const collectionConfig = payload.collections['users'].config
  const tokenExpiration = collectionConfig?.auth?.tokenExpiration || 60 * 60 * 24 * 7
  const useSessions = collectionConfig?.auth?.useSessions !== false

  const fieldsToSign: Record<string, any> = {
    id: user.id,
    email: user.email,
    collection: 'users',
  }

  // Create a session if sessions are enabled (Payload 3 default)
  if (useSessions) {
    const sid = uuid()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + tokenExpiration * 1000)

    // Get current sessions and clean expired ones
    const currentSessions = (user.sessions || []).filter((s: any) => {
      const expiry = s.expiresAt instanceof Date ? s.expiresAt : new Date(s.expiresAt)
      return expiry > now
    })

    currentSessions.push({
      id: sid,
      createdAt: now,
      expiresAt,
    })

    // Update user with new session
    await payload.db.updateOne({
      id: user.id,
      collection: 'users',
      data: { ...user, sessions: currentSessions, updatedAt: null },
      req: { payload } as any,
      returning: false,
    })

    fieldsToSign.sid = sid
    console.log(`[Discord OAuth] Created session ${sid} for user ${user.id}`)
  }

  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration,
  })

  console.log(`[Discord OAuth] Generated JWT for user ${user.id} (${user.email}), redirecting to ${returnUrl || '/admin'}`)

  const response = NextResponse.redirect(new URL(returnUrl || '/admin', serverUrl))
  response.cookies.set('payload-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: tokenExpiration,
  })

  return response
}
