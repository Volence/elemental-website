import type { Payload } from 'payload'

/**
 * Finalize one FACEIT league template: archive every linked team season's
 * match history, mark the seasons and the league inactive. Shared by the
 * finalize-season route and the season rollover.
 */

const TEAM_LEAGUES_BASE = 'https://www.faceit.com/api/team-leagues/v2'
const CHAMPIONSHIPS_BASE = 'https://www.faceit.com/api/championships/v1'
const DATA_API_BASE = 'https://open.faceit.com/data/v4'

export interface FaceitMatch {
  factions: Array<{ id: string; number: number }>
  status: 'created' | 'finished'
  winner?: string
  origin: { id: string; state: string; schedule: number }
}

export interface ArchivedMatch {
  matchDate: string
  opponent: string
  result: 'win' | 'loss' | 'pending'
  faceitMatchId: string
}

export interface FinalizeDeps {
  fetchStandingsTeamNames(stageId: string): Promise<Map<string, string>>
  fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]>
  fetchTeamName(teamId: string): Promise<string>
}

export interface FinalizeLeagueResult {
  seasonsArchived: number
  matchesArchived: number
  errors: string[]
}

async function fetchTeamName(teamId: string): Promise<string> {
  const key = process.env.FACEIT_API_KEY
  if (!key) return 'Unknown'
  try {
    const res = await fetch(`${DATA_API_BASE}/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) {
      const data = await res.json()
      return data.name || data.nickname || 'Unknown'
    }
  } catch {
    // fall through to Unknown
  }
  return 'Unknown'
}

async function fetchStandingsTeamNames(stageId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  try {
    const res = await fetch(`${TEAM_LEAGUES_BASE}/standings?entityType=stage&entityId=${stageId}&offset=0&limit=100`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return names
    const data = await res.json()
    for (const s of data.payload?.standings || []) {
      if (s.premade_team_id && s.name) names.set(s.premade_team_id, s.name)
    }
  } catch (e) {
    console.error('[Finalize] Error fetching standings:', e)
  }
  return names
}

async function fetchMatches(teamId: string, championshipId: string): Promise<FaceitMatch[]> {
  try {
    const res = await fetch(
      `${CHAMPIONSHIPS_BASE}/matches?participantId=${teamId}&participantType=TEAM&championshipId=${championshipId}&limit=70&offset=0&sort=ASC`,
      { signal: AbortSignal.timeout(15_000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.payload?.items || []
  } catch {
    return []
  }
}

export const defaultFinalizeDeps: FinalizeDeps = { fetchStandingsTeamNames, fetchMatches, fetchTeamName }

function toIso(schedule: number | undefined): string {
  if (!schedule) return new Date().toISOString()
  // FACEIT schedules come as seconds or milliseconds
  const ms = schedule > 1e12 ? schedule : schedule * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime()) || d.getFullYear() <= 2000 || d.getFullYear() >= 2100) return new Date().toISOString()
  return d.toISOString()
}

/** Pure: FACEIT matches to archive rows. Unknown or missing opponents read as BYE. */
export function buildArchivedMatches(matches: FaceitMatch[], faceitTeamId: string, names: Map<string, string>): ArchivedMatch[] {
  const rows: ArchivedMatch[] = []
  for (const match of matches) {
    const opponentId = match.factions.find((f) => f.id !== faceitTeamId)?.id || ''
    let opponent = opponentId ? names.get(opponentId) : undefined
    if (!opponent || opponent === 'Unknown') opponent = 'BYE'
    const finished = match.status === 'finished'
    rows.push({
      matchDate: toIso(match.origin?.schedule),
      opponent,
      result: finished ? (match.winner === faceitTeamId ? 'win' : 'loss') : 'pending',
      faceitMatchId: match.origin.id,
    })
  }
  return rows.filter((m, i, self) => i === self.findIndex((x) => x.faceitMatchId === m.faceitMatchId))
}

export async function finalizeLeague(
  payload: Payload,
  league: { id: number; name: string; stageId?: string | null; championshipId?: string | null },
  deps: FinalizeDeps = defaultFinalizeDeps,
): Promise<FinalizeLeagueResult> {
  const result: FinalizeLeagueResult = { seasonsArchived: 0, matchesArchived: 0, errors: [] }

  const seasons = await payload.find({
    collection: 'faceit-seasons',
    where: { faceitLeague: { equals: league.id } },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })

  const standingsNames = league.stageId ? await deps.fetchStandingsTeamNames(league.stageId) : new Map<string, string>()

  for (const season of seasons.docs as any[]) {
    try {
      const championshipId = season.championshipId || league.championshipId
      const faceitTeamId = season.faceitTeamId
      if (!faceitTeamId || !championshipId) continue

      const matches = await deps.fetchMatches(faceitTeamId, championshipId)
      // Resolve opponent names not covered by standings before the pure step
      const names = new Map(standingsNames)
      for (const m of matches) {
        const oppId = m.factions.find((f) => f.id !== faceitTeamId)?.id
        if (oppId && !names.has(oppId)) names.set(oppId, await deps.fetchTeamName(oppId))
      }
      const archived = buildArchivedMatches(matches, faceitTeamId, names)

      // Direct SQL: Payload generates ObjectID-style ids for array rows but the table uses serial integers
      const drizzle = (payload.db as any)?.drizzle
      if (!drizzle) throw new Error('Drizzle ORM not available')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dual drizzle-orm version conflict (Payload bundles its own copy)
      const { sql } = (await import('drizzle-orm')) as any
      await drizzle.execute(sql`
        UPDATE faceit_seasons
        SET is_active = false, archived_at = ${new Date().toISOString()}, in_playoffs = false
        WHERE id = ${season.id}
      `)
      await drizzle.execute(sql`DELETE FROM faceit_seasons_archived_matches WHERE _parent_id = ${season.id}`)
      for (let i = 0; i < archived.length; i++) {
        const m = archived[i]
        await drizzle.execute(sql`
          INSERT INTO faceit_seasons_archived_matches (_order, _parent_id, match_date, opponent, result, faceit_match_id)
          VALUES (${i + 1}, ${season.id}, ${m.matchDate}, ${m.opponent}, ${m.result}, ${m.faceitMatchId})
        `)
      }
      result.seasonsArchived++
      result.matchesArchived += archived.length
      await new Promise((r) => setTimeout(r, 500))
    } catch (err: any) {
      result.errors.push(`Season ${season.id}: ${err.message}`)
    }
  }

  await payload.update({ collection: 'faceit-leagues', id: league.id, data: { isActive: false }, overrideAccess: true })
  return result
}
