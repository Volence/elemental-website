import type { Payload } from 'payload'
import {
  FACEIT_LEAGUE_ID,
  buildRolloverPlan,
  createFaceitFetchers,
  detectSeasons,
  loadSubscriptions,
  type ExistingLeagueInput,
  type RolloverPlan,
  type RolloverTeamInput,
  type SeasonDetection,
} from './faceitRollover'

/**
 * Server-side glue for the rollover planner: reads our teams and league
 * templates through Payload, talks to FACEIT through the real fetchers.
 * Shared by the rollover route and the FACEIT teams overview.
 */

export interface RolloverInputs {
  teamInputs: RolloverTeamInput[]
  leagueInputs: ExistingLeagueInput[]
  ourLatest: number | null
}

export async function loadRolloverInputs(payload: Payload): Promise<RolloverInputs> {
  const [teams, leagues] = await Promise.all([
    payload.find({ collection: 'teams', limit: 500, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'faceit-leagues', limit: 200, depth: 0, overrideAccess: true }),
  ])
  const teamInputs: RolloverTeamInput[] = teams.docs.map((t: any) => ({
    id: t.id,
    name: t.name,
    active: t.active !== false,
    faceitEnabled: t.faceitEnabled === true,
    faceitTeamId: t.faceitTeamId || null,
    currentFaceitLeague:
      typeof t.currentFaceitLeague === 'object' ? (t.currentFaceitLeague?.id ?? null) : (t.currentFaceitLeague ?? null),
    currentLeagueName: typeof t.currentFaceitLeague === 'object' ? (t.currentFaceitLeague?.name ?? null) : null,
  }))
  const leagueInputs: ExistingLeagueInput[] = leagues.docs.map((l: any) => ({
    id: l.id,
    name: l.name,
    seasonId: l.seasonId || null,
    stageId: l.stageId || null,
    isActive: l.isActive === true,
    seasonNumber: typeof l.seasonNumber === 'number' ? l.seasonNumber : null,
  }))
  const ourLatest = leagueInputs.reduce<number | null>(
    (max, l) => (l.seasonNumber != null && (max === null || l.seasonNumber > max) ? l.seasonNumber : max),
    null,
  )
  return { teamInputs, leagueInputs, ourLatest }
}

export interface SeasonDetectionWithTeams extends SeasonDetection {
  /** Enabled, active teams not yet on the latest season (no league, or an older one) */
  teamsBehind: number
}

export async function detectFaceitSeasons(payload: Payload): Promise<SeasonDetectionWithTeams> {
  const fetchers = createFaceitFetchers(process.env.FACEIT_API_KEY)
  const seasons = await fetchers.fetchSeasons(FACEIT_LEAGUE_ID)
  const { ourLatest, teamInputs, leagueInputs } = await loadRolloverInputs(payload)
  const detection = detectSeasons(seasons, ourLatest)
  const latestNumber = detection.latest?.number ?? null
  const seasonOfLeague = new Map(leagueInputs.map((l) => [l.id, l.seasonNumber]))
  const teamsBehind = teamInputs.filter((t) => {
    if (!t.active || !t.faceitEnabled) return false
    if (t.currentFaceitLeague == null) return true
    const season = seasonOfLeague.get(t.currentFaceitLeague) ?? null
    return latestNumber != null && (season ?? 0) < latestNumber
  }).length
  return { ...detection, teamsBehind }
}

/** Full dry-run plan for one FACEIT season. Reads FACEIT live. */
export async function buildPlanForSeason(payload: Payload, seasonId: string): Promise<RolloverPlan> {
  const fetchers = createFaceitFetchers(process.env.FACEIT_API_KEY)
  const seasons = await fetchers.fetchSeasons(FACEIT_LEAGUE_ID)
  const season = seasons.find((s) => s.id === seasonId)
  if (!season) throw new Error(`Season ${seasonId} is not published by FACEIT`)
  const tree = await fetchers.fetchSeasonTree(season.id)
  const { teamInputs, leagueInputs } = await loadRolloverInputs(payload)
  const warnings: string[] = []
  // A first pass gives the leagues so their championships can be queried
  const leaguesOnly = buildRolloverPlan({
    season,
    tree,
    teams: [],
    existingLeagues: leagueInputs,
    subscriptions: new Map(),
    leagueId: FACEIT_LEAGUE_ID,
  })
  const subscriptions = process.env.FACEIT_API_KEY ? await loadSubscriptions(leaguesOnly.leagues, fetchers, warnings) : null
  const plan = buildRolloverPlan({ season, tree, teams: teamInputs, existingLeagues: leagueInputs, subscriptions, leagueId: FACEIT_LEAGUE_ID })
  plan.warnings.push(...warnings)
  return plan
}

/**
 * The registration picture for the latest published season, cached so the
 * teams overview does not hit FACEIT's fourteen subscription endpoints on
 * every page load. `refresh` forces a new lookup.
 */
const REGISTRATION_TTL_MS = 10 * 60 * 1000
let cached: { at: number; seasonId: string; plan: RolloverPlan } | null = null
let inflight: Promise<RolloverPlan> | null = null

export async function getLatestSeasonPlan(payload: Payload, refresh = false): Promise<{ plan: RolloverPlan; checkedAt: string } | null> {
  const detection = await detectFaceitSeasons(payload)
  if (!detection.latest) return null
  const seasonId = detection.latest.id
  if (!refresh && cached && cached.seasonId === seasonId && Date.now() - cached.at < REGISTRATION_TTL_MS) {
    return { plan: cached.plan, checkedAt: new Date(cached.at).toISOString() }
  }
  if (!inflight) {
    inflight = buildPlanForSeason(payload, seasonId)
      .then((plan) => {
        cached = { at: Date.now(), seasonId, plan }
        return plan
      })
      .finally(() => {
        inflight = null
      })
  }
  const plan = await inflight
  return { plan, checkedAt: new Date(cached?.at ?? Date.now()).toISOString() }
}

export function invalidateLatestSeasonPlan(): void {
  cached = null
}

/**
 * Non-blocking variant for page loads: return whatever is cached (even if
 * stale) and, when the cache is missing, stale, or a refresh was asked for,
 * start one lookup in the background. `pending` tells the caller to poll.
 */
let background: Promise<void> | null = null

export function peekLatestSeasonPlan(payload: Payload, refresh = false): { plan: RolloverPlan | null; checkedAt: string | null; pending: boolean } {
  const fresh = !!cached && Date.now() - cached.at < REGISTRATION_TTL_MS
  if ((!fresh || refresh) && !background) {
    // Set synchronously so this very response can report pending: true
    background = getLatestSeasonPlan(payload, true)
      .then(() => undefined)
      .catch((err) => {
        console.error('[FaceitRolloverLoad] background registration lookup failed:', (err as Error).message)
      })
      .finally(() => {
        background = null
      })
  }
  return {
    plan: cached?.plan ?? null,
    checkedAt: cached ? new Date(cached.at).toISOString() : null,
    pending: !!background,
  }
}
