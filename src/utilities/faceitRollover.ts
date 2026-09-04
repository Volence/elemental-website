/**
 * FACEIT season rollover planning.
 *
 * Pure functions build a RolloverPlan from FACEIT API JSON plus our teams and
 * league templates. Fetchers are injected so the planner is unit-testable;
 * `createFaceitFetchers` wires the real endpoints. Applying the plan lives in
 * src/discord/services/faceitRolloverApply.ts.
 */
import { FACEIT_DIVISIONS, type FaceitDivision } from './divisions'

export const FACEIT_LEAGUE_ID = process.env.FACEIT_LEAGUE_ID || '88c7f7ec-4cb8-44d3-a5db-6e808639c232'
const TEAM_LEAGUES_BASE = 'https://www.faceit.com/api/team-leagues/v2'
const DATA_API_BASE = 'https://open.faceit.com/data/v4'

export const ROLLOVER_REGIONS = ['NA', 'EMEA', 'SA', 'OCE'] as const
export type RolloverRegion = (typeof ROLLOVER_REGIONS)[number]

export interface FaceitSeasonInfo {
  id: string
  number: number
  start: string | null
  end: string | null
}

export interface RolloverFetchers {
  fetchSeasons(leagueId: string): Promise<FaceitSeasonInfo[]>
  fetchSeasonTree(seasonId: string): Promise<any | null>
  /** Registered premade teams for a championship (Data API, needs FACEIT_API_KEY). */
  fetchChampionshipTeams(championshipId: string): Promise<Array<{ teamId: string; name: string }>>
}

export interface SeasonDetection {
  latest: FaceitSeasonInfo | null
  ours: number | null
  rolloverAvailable: boolean
}

export function detectSeasons(seasons: FaceitSeasonInfo[], ourLatestSeasonNumber: number | null): SeasonDetection {
  const latest = seasons.reduce<FaceitSeasonInfo | null>((best, s) => (!best || s.number > best.number ? s : best), null)
  const rolloverAvailable = !!latest && (ourLatestSeasonNumber === null || latest.number > ourLatestSeasonNumber)
  return { latest, ours: ourLatestSeasonNumber, rolloverAvailable }
}

export function createFaceitFetchers(apiKey: string | undefined): RolloverFetchers {
  return {
    async fetchSeasons(leagueId) {
      const res = await fetch(`${TEAM_LEAGUES_BASE}/leagues/${leagueId}/seasons`, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`FACEIT seasons list returned ${res.status}`)
      const data = await res.json()
      return ((data?.payload as any[]) || []).map((s) => ({
        id: String(s.id),
        number: Number(s.season_number),
        start: s.time_start ?? null,
        end: s.time_end ?? null,
      }))
    },
    async fetchSeasonTree(seasonId) {
      const res = await fetch(`${TEAM_LEAGUES_BASE}/seasons/tree?entityType=season&entityId=${seasonId}`, {
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw new Error(`FACEIT season tree returned ${res.status}`)
      const data = await res.json()
      return data?.payload ?? null
    },
    async fetchChampionshipTeams(championshipId) {
      if (!apiKey) throw new Error('FACEIT_API_KEY is not set')
      const teams: Array<{ teamId: string; name: string }> = []
      const limit = 100
      for (let offset = 0; offset < 1000; offset += limit) {
        const res = await fetch(`${DATA_API_BASE}/championships/${championshipId}/subscriptions?offset=${offset}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) throw new Error(`FACEIT subscriptions returned ${res.status} for ${championshipId}`)
        const data = await res.json()
        const items: any[] = data?.items || []
        for (const item of items) {
          const t = item?.team
          if (t?.team_id) teams.push({ teamId: String(t.team_id), name: String(t.name || '') })
        }
        if (items.length < limit) break
      }
      return teams
    },
  }
}

// Division / region normalisation shared by the tree walk
export function normalizeDivision(name: string): FaceitDivision | null {
  const lower = name.trim().toLowerCase()
  if (lower === 'master' || lower === 'masters') return 'Masters'
  const hit = FACEIT_DIVISIONS.find((d) => d.toLowerCase() === lower)
  return hit ?? null
}

export function normalizeRegion(codeOrName: string): RolloverRegion | null {
  const v = codeOrName.trim().toUpperCase()
  if (v === 'NA' || v === 'NORTH AMERICA') return 'NA'
  if (v === 'EMEA' || v === 'EUROPE') return 'EMEA'
  if (v === 'SA' || v === 'SOUTH AMERICA') return 'SA'
  if (v === 'OCE' || v === 'OCEANIA') return 'OCE'
  return null
}

export interface PlannedLeague {
  /** `${seasonId}:${stageId}` */
  key: string
  /** "Season 10 Masters NA" */
  name: string
  seasonNumber: number
  division: FaceitDivision
  region: RolloverRegion
  conference: string
  leagueId: string
  seasonId: string
  stageId: string
  championshipId: string
  /** Existing template id when one already matches season + stage */
  existingId: number | null
}

function isRegularSeasonStage(stage: any): boolean {
  const name = String(stage?.name || '').trim().toLowerCase()
  if (!name) return false
  if (name.includes('playoff')) return false
  if (stage?.bracket_style === 'doubleElimination') return false
  return name.startsWith('regular season')
}

/** Regular-season stages in tracked regions and divisions, one PlannedLeague each. */
export function leaguesFromTree(tree: any, season: FaceitSeasonInfo, leagueId: string): PlannedLeague[] {
  const out: PlannedLeague[] = []
  for (const region of tree?.regions || []) {
    const regionCode = normalizeRegion(String(region.code || region.name || ''))
    if (!regionCode) continue
    for (const division of region.divisions || []) {
      const div = normalizeDivision(String(division.name || ''))
      if (!div) continue
      for (const stage of division.stages || []) {
        if (!isRegularSeasonStage(stage)) continue
        const conference = (stage.conferences || []).find((c: any) => c?.championship_id) ?? null
        if (!conference) continue
        out.push({
          key: `${season.id}:${stage.id}`,
          name: `Season ${season.number} ${div} ${regionCode}`,
          seasonNumber: season.number,
          division: div,
          region: regionCode,
          conference: String(conference.name || '').trim(),
          leagueId,
          seasonId: season.id,
          stageId: String(stage.id),
          championshipId: String(conference.championship_id),
          existingId: null,
        })
      }
    }
  }
  return out
}

export interface RolloverTeamInput {
  id: number
  name: string
  active: boolean
  faceitEnabled: boolean
  faceitTeamId: string | null
  currentFaceitLeague: number | null
  currentLeagueName: string | null
}

export interface ExistingLeagueInput {
  id: number
  name: string
  seasonId: string | null
  stageId: string | null
  isActive: boolean
  seasonNumber: number | null
}

export interface TeamAssignment {
  teamId: number
  teamName: string
  fromLeague: string | null
  toKey: string
  toName: string
}

export interface UnmatchedTeam {
  teamId: number
  teamName: string
  faceitTeamId: string | null
  suggestions: Array<{ faceitTeamId: string; faceitName: string; leagueKey: string; leagueName: string }>
}

export interface RolloverPlan {
  season: FaceitSeasonInfo
  leagues: PlannedLeague[]
  assignments: TeamAssignment[]
  unmatched: UnmatchedTeam[]
  conflicts: Array<{ teamId: number; teamName: string; leagueKeys: string[] }>
  finalize: Array<{ id: number; name: string }>
  stalePointers: Array<{ teamId: number; teamName: string; leagueName: string | null }>
  warnings: string[]
}

export type SubscriptionMap = Map<string, Array<{ teamId: string; name: string }>>

export interface BuildPlanArgs {
  season: FaceitSeasonInfo
  tree: any
  teams: RolloverTeamInput[]
  existingLeagues: ExistingLeagueInput[]
  /** championshipId -> registered teams; null when the Data API key is missing */
  subscriptions: SubscriptionMap | null
  leagueId: string
}

function looksLikeOurs(faceitName: string, teamName: string): boolean {
  const n = faceitName.toLowerCase()
  return n.includes('elmt') && n.includes(teamName.toLowerCase())
}

export function buildRolloverPlan(args: BuildPlanArgs): RolloverPlan {
  const warnings: string[] = []
  const leagues = leaguesFromTree(args.tree, args.season, args.leagueId)

  // Reuse templates that already exist for this season + stage
  for (const league of leagues) {
    const hit = args.existingLeagues.find((e) => e.seasonId === league.seasonId && e.stageId === league.stageId)
    league.existingId = hit ? hit.id : null
  }
  const leagueByChampionship = new Map(leagues.map((l) => [l.championshipId, l]))

  // Which planned league each FACEIT team id registered in
  const registrations = new Map<string, PlannedLeague[]>()
  if (args.subscriptions) {
    for (const [championshipId, regs] of args.subscriptions) {
      const league = leagueByChampionship.get(championshipId)
      if (!league) continue
      for (const reg of regs) {
        const list = registrations.get(reg.teamId) ?? []
        list.push(league)
        registrations.set(reg.teamId, list)
      }
    }
  } else {
    warnings.push('FACEIT_API_KEY missing or subscriptions unavailable: team assignment skipped, leagues only')
  }

  const assignments: TeamAssignment[] = []
  const unmatched: UnmatchedTeam[] = []
  const conflicts: RolloverPlan['conflicts'] = []
  const stalePointers: RolloverPlan['stalePointers'] = []

  for (const team of args.teams) {
    const eligible = team.active && team.faceitEnabled
    if (!eligible) {
      if (team.currentFaceitLeague != null) {
        stalePointers.push({ teamId: team.id, teamName: team.name, leagueName: team.currentLeagueName })
      }
      continue
    }
    const found = team.faceitTeamId ? registrations.get(team.faceitTeamId) ?? [] : []
    if (found.length === 1) {
      assignments.push({ teamId: team.id, teamName: team.name, fromLeague: team.currentLeagueName, toKey: found[0].key, toName: found[0].name })
      continue
    }
    if (found.length > 1) {
      conflicts.push({ teamId: team.id, teamName: team.name, leagueKeys: found.map((l) => l.key) })
      continue
    }
    const suggestions: UnmatchedTeam['suggestions'] = []
    if (args.subscriptions) {
      for (const [championshipId, regs] of args.subscriptions) {
        const league = leagueByChampionship.get(championshipId)
        if (!league) continue
        for (const reg of regs) {
          if (reg.teamId === team.faceitTeamId) continue
          if (looksLikeOurs(reg.name, team.name)) {
            suggestions.push({ faceitTeamId: reg.teamId, faceitName: reg.name, leagueKey: league.key, leagueName: league.name })
          }
        }
      }
    }
    unmatched.push({ teamId: team.id, teamName: team.name, faceitTeamId: team.faceitTeamId, suggestions })
  }

  const finalize = args.existingLeagues
    .filter((e) => e.isActive && (e.seasonNumber ?? 0) < args.season.number)
    .map((e) => ({ id: e.id, name: e.name }))

  return { season: args.season, leagues, assignments, unmatched, conflicts, finalize, stalePointers, warnings }
}

/** Fetch registrations for every planned championship; failures become warnings, not errors. */
export async function loadSubscriptions(leagues: PlannedLeague[], fetchers: RolloverFetchers, warnings: string[]): Promise<SubscriptionMap> {
  const map: SubscriptionMap = new Map()
  for (const league of leagues) {
    try {
      map.set(league.championshipId, await fetchers.fetchChampionshipTeams(league.championshipId))
    } catch (err) {
      warnings.push(`${league.name}: could not load registered teams (${(err as Error).message})`)
      map.set(league.championshipId, [])
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return map
}
