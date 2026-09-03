import { NextRequest, NextResponse } from 'next/server'
import { createLocalReq } from 'payload'

import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { buildReport } from '@/accessReview/compute'
import type { AccessReport } from '@/accessReview/types'
import { resolveMutation } from '@/accessReview/mutate'
import { getDiscordClient } from '@/discord/bot'
import { resolveGuildId } from '@/discord/serverRegistry'
import { isRosterComplete } from '@/accessReview/discordRoster'

const CACHE_TTL_MS = 60_000

let cached: { at: number; report: AccessReport } | null = null

// Not exported: Next.js route modules only permit HTTP method handlers and a small
// fixed set of config exports (verified via tsc - anything else fails the generated
// route type check). PATCH is appended to this same file in a later task and can call
// this directly since it shares module scope.
function invalidateAccessReviewCache(): void {
  cached = null
}

/**
 * Guild member ids for the primary server, or null when the check could not run.
 * null must never be shown as "this person left" - the bot is dark after each deploy until
 * the first Payload-booting request, so an unavailable client is routine.
 */
async function fetchGuildMemberIds(): Promise<{ ids: Set<string> | null; guildId: string | null }> {
  try {
    const client = getDiscordClient()
    if (!client) return { ids: null, guildId: null }

    const guildId = await resolveGuildId()
    const guild = await client.guilds.fetch(guildId)
    // The logging module's roster fetch is fire-and-forget and GUILD_CREATE seeds a partial
    // cache, so "non-empty" is not "complete". Only trust a cache that holds everyone.
    const members = isRosterComplete(guild.members.cache.size, guild.memberCount)
      ? guild.members.cache
      : await guild.members.fetch()

    return { ids: new Set([...members.values()].map((member) => member.id)), guildId }
  } catch {
    return { ids: null, guildId: null }
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  const refresh = request.nextUrl.searchParams.get('refresh') === '1'
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, report: cached.report, cached: true })
  }

  const { payload } = auth.data

  try {
    const [people, teams, sessions, audits, discord] = await Promise.all([
      payload.find({ collection: 'people', limit: 0, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'teams', limit: 0, depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'active-sessions',
        limit: 5000,
        sort: '-loginTime',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'audit-logs',
        where: { collection: { equals: 'people' }, action: { equals: 'update' } },
        limit: 3000,
        sort: '-createdAt',
        depth: 1,
        overrideAccess: true,
      }),
      fetchGuildMemberIds(),
    ])

    const report = buildReport({
      people: people.docs as never,
      teams: teams.docs as never,
      sessions: sessions.docs as never,
      accessAudits: audits.docs as never,
      discordMemberIds: discord.ids,
      guildId: discord.guildId,
      now: Date.now(),
    })

    cached = { at: Date.now(), report }
    return NextResponse.json({ success: true, report, cached: false })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Failed to build access report: ${error?.message}` },
      { status: 500 },
    )
  }
}

/**
 * Apply exactly one access delta. One field per call rather than PATCHing the whole person
 * document from the client, so a concurrent edit elsewhere is not clobbered and each change
 * produces one precise audit entry.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  const { payload, user } = auth.data

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const personId = Number(body.personId)
  if (!Number.isFinite(personId)) {
    return NextResponse.json({ success: false, error: 'personId must be a number' }, { status: 400 })
  }

  const person = await payload
    .findByID({ collection: 'people', id: personId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!person) {
    return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 })
  }

  // Only counted when a role change could remove an admin, to keep the common path cheap.
  let adminCount = Number.POSITIVE_INFINITY
  if (body.kind === 'role' && person.role === 'admin' && body.value !== 'admin') {
    const counted = await payload.count({
      collection: 'people',
      where: { role: { equals: 'admin' } },
      overrideAccess: true,
    })
    adminCount = counted.totalDocs
  }

  const resolved = resolveMutation({ person: person as never, body, actorId: user.id, adminCount })
  if (!resolved.ok) {
    return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status })
  }

  try {
    // A req carrying the acting admin is what makes the People audit hook record who did this.
    const req = await createLocalReq({ user: user as never }, payload)
    const updated = await payload.update({
      collection: 'people',
      id: personId,
      data: resolved.data,
      req,
      overrideAccess: true,
    })

    invalidateAccessReviewCache()

    return NextResponse.json({
      success: true,
      person: {
        id: updated.id,
        role: updated.role ?? null,
        departments: updated.departments ?? {},
        assignedTeams: (updated.assignedTeams ?? []).map((entry: any) =>
          typeof entry === 'number' ? entry : entry?.id,
        ),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `Update failed: ${error?.message}` },
      { status: 500 },
    )
  }
}
