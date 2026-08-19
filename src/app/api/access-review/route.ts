import { NextRequest, NextResponse } from 'next/server'

import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { buildReport } from '@/accessReview/compute'
import type { AccessReport } from '@/accessReview/types'
import { getDiscordClient } from '@/discord/bot'
import { resolveGuildId } from '@/discord/serverRegistry'

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
    // The logging module fetches the full roster on ready, so the cache is normally warm.
    const members = guild.members.cache.size > 0 ? guild.members.cache : await guild.members.fetch()

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
