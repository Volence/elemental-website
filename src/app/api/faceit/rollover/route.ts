import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import {
  FACEIT_LEAGUE_ID,
  buildRolloverPlan,
  createFaceitFetchers,
  detectSeasons,
  loadSubscriptions,
  type ExistingLeagueInput,
  type RolloverPlan,
  type RolloverTeamInput,
} from '@/utilities/faceitRollover'
import { applyRolloverPlan, isRolloverRunning, type RolloverOverrides } from '@/discord/services/faceitRolloverApply'

/**
 * FACEIT season rollover.
 * GET  ?seasonId=  -> detection (+ dry-run plan when seasonId given). No writes.
 * POST { seasonId, overrides } -> applies the plan, returns the report.
 * Admin only.
 */

async function loadInputs(payload: Payload) {
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

async function buildPlanFor(payload: Payload, seasonId: string): Promise<RolloverPlan> {
  const fetchers = createFaceitFetchers(process.env.FACEIT_API_KEY)
  const seasons = await fetchers.fetchSeasons(FACEIT_LEAGUE_ID)
  const season = seasons.find((s) => s.id === seasonId)
  if (!season) throw new Error(`Season ${seasonId} is not published by FACEIT`)
  const tree = await fetchers.fetchSeasonTree(season.id)
  const { teamInputs, leagueInputs } = await loadInputs(payload)
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

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    const payload = await getPayload({ config: configPromise })
    const fetchers = createFaceitFetchers(process.env.FACEIT_API_KEY)
    const seasons = await fetchers.fetchSeasons(FACEIT_LEAGUE_ID)
    const { ourLatest } = await loadInputs(payload)
    const detection = detectSeasons(seasons, ourLatest)
    const seasonId = new URL(request.url).searchParams.get('seasonId')
    const plan = seasonId ? await buildPlanFor(payload, seasonId) : null
    return NextResponse.json({ detection, plan, running: isRolloverRunning() })
  } catch (error: any) {
    console.error('[FaceitRollover] GET error:', error)
    return NextResponse.json({ error: error.message || 'Could not reach FACEIT' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    if (isRolloverRunning()) return NextResponse.json({ error: 'A rollover is already running' }, { status: 409 })
    const body = await request.json().catch(() => ({}))
    const seasonId = typeof body?.seasonId === 'string' ? body.seasonId : ''
    if (!seasonId) return NextResponse.json({ error: 'seasonId is required' }, { status: 400 })
    const overrides: RolloverOverrides = body?.overrides && typeof body.overrides === 'object' ? body.overrides : {}
    const payload = await getPayload({ config: configPromise })
    const plan = await buildPlanFor(payload, seasonId)
    const report = await applyRolloverPlan(payload, plan, overrides)
    payload.logger.info(
      `[faceit] Rollover to season ${report.season} by user ${auth.data.user.id}: ${JSON.stringify({
        created: report.leaguesCreated,
        moved: report.teamsAssigned.length,
        errors: report.errors.length,
      })}`,
    )
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[FaceitRollover] POST error:', error)
    return NextResponse.json({ error: error.message || 'Rollover failed' }, { status: 500 })
  }
}
