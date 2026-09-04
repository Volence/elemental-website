import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { invalidateLatestSeasonPlan, peekLatestSeasonPlan } from '@/utilities/faceitRolloverLoad'
import { syncTeamData } from '@/utilities/faceitSync'
import type { FaceitTeamRow, FaceitOverviewLeague } from '@/utilities/faceitTeamStatus'

/**
 * FACEIT teams overview: every team's FACEIT configuration in one response,
 * with FACEIT's registration picture for the latest season folded in.
 *
 * GET  ?refresh=1        -> { latestSeasonNumber, leagues, teams, registrationCheckedAt,
 *                            registrationPending, warnings }
 *   The FACEIT registration lookup (14 calls) runs in the background; the
 *   response never waits for it. While `registrationPending` is true the
 *   client polls and the registration column fills in when it lands.
 * POST { action, teamId } -> 'sync' runs the team's sync; 'clearLeague' drops a
 *                            stale league pointer on a disabled or inactive team.
 * Admin only. Field edits go through the normal /api/teams/:id PATCH.
 */

async function buildOverview(payload: Payload, refresh: boolean) {
  const [teams, leagues] = await Promise.all([
    payload.find({ collection: 'teams', limit: 500, depth: 0, overrideAccess: true, sort: 'name' }),
    payload.find({ collection: 'faceit-leagues', limit: 200, depth: 0, overrideAccess: true, sort: '-seasonNumber' }),
  ])
  const seasonIds = teams.docs.map((t: any) => t.currentFaceitSeason).filter((id: any) => typeof id === 'number')
  const seasons = seasonIds.length
    ? await payload.find({ collection: 'faceit-seasons', where: { id: { in: seasonIds } }, limit: 500, depth: 0, overrideAccess: true })
    : { docs: [] as any[] }
  const seasonById = new Map<number, any>(seasons.docs.map((s: any) => [s.id, s]))
  const leagueById = new Map<number, any>(leagues.docs.map((l: any) => [l.id, l]))

  const warnings: string[] = []
  const registration = peekLatestSeasonPlan(payload, refresh)
  const plan = registration.plan
  const assignedByTeam = new Map(plan?.assignments.map((a) => [a.teamId, a]) ?? [])
  const unmatchedByTeam = new Map(plan?.unmatched.map((u) => [u.teamId, u]) ?? [])
  const conflictTeams = new Set(plan?.conflicts.map((c) => c.teamId) ?? [])
  const registrationKnown = !!plan && plan.warnings.every((w) => !w.includes('FACEIT_API_KEY'))
  const plannedLeagueIdByKey = new Map<string, number | null>(plan?.leagues.map((l) => [l.key, l.existingId]) ?? [])

  const rows: FaceitTeamRow[] = teams.docs.map((t: any) => {
    const leagueId = typeof t.currentFaceitLeague === 'object' ? t.currentFaceitLeague?.id : t.currentFaceitLeague
    const league = leagueId ? leagueById.get(leagueId) : null
    const seasonId = typeof t.currentFaceitSeason === 'object' ? t.currentFaceitSeason?.id : t.currentFaceitSeason
    const season = seasonId ? seasonById.get(seasonId) : null
    const assigned = assignedByTeam.get(t.id)
    const unmatched = unmatchedByTeam.get(t.id)
    let reg: FaceitTeamRow['registration'] = 'unknown'
    if (registrationKnown && t.faceitEnabled && t.active !== false) {
      if (assigned) reg = 'registered'
      else if (conflictTeams.has(t.id)) reg = 'conflict'
      else if (unmatched) reg = 'not-registered'
    }
    return {
      id: t.id,
      name: t.name,
      region: t.region || null,
      active: t.active !== false,
      faceitEnabled: t.faceitEnabled === true,
      faceitTeamId: t.faceitTeamId || null,
      faceitWithdrawn: t.faceitWithdrawn === true,
      league: league
        ? { id: league.id, name: league.name, isActive: league.isActive === true, seasonNumber: league.seasonNumber ?? null }
        : null,
      season: season ? { id: season.id, isActive: season.isActive === true, lastSynced: season.lastSynced ?? null } : null,
      registration: reg,
      registeredLeague: assigned?.toName ?? null,
      suggestions: (unmatched?.suggestions ?? []).map((s) => ({
        faceitTeamId: s.faceitTeamId,
        faceitName: s.faceitName,
        leagueName: s.leagueName,
        leagueId: plannedLeagueIdByKey.get(s.leagueKey) ?? null,
      })),
    }
  })

  const activeLeagues: FaceitOverviewLeague[] = leagues.docs
    .filter((l: any) => l.isActive)
    .map((l: any) => ({ id: l.id, name: l.name, isActive: true, seasonNumber: l.seasonNumber ?? null }))

  return {
    latestSeasonNumber: plan?.season.number ?? activeLeagues.reduce<number | null>((m, l) => (l.seasonNumber != null && (m === null || l.seasonNumber > m) ? l.seasonNumber : m), null),
    leagues: activeLeagues,
    teams: rows,
    registrationCheckedAt: registration.checkedAt,
    registrationPending: registration.pending,
    warnings: [...warnings, ...(plan?.warnings ?? [])],
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    const payload = await getPayload({ config: configPromise })
    const refresh = new URL(request.url).searchParams.get('refresh') === '1'
    return NextResponse.json(await buildOverview(payload, refresh))
  } catch (error: any) {
    console.error('[FaceitTeamsOverview] GET error:', error)
    return NextResponse.json({ error: error.message || 'Could not load overview' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  try {
    const body = await request.json().catch(() => ({}))
    const teamId = Number(body?.teamId)
    const action = String(body?.action || '')
    if (!Number.isFinite(teamId) || teamId <= 0) return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    const payload = await getPayload({ config: configPromise })

    if (action === 'sync') {
      const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 1, overrideAccess: true })
      const league = (team as any).currentFaceitLeague
      if (!league || typeof league !== 'object') return NextResponse.json({ error: 'Team has no league' }, { status: 400 })
      const result = await syncTeamData(
        teamId,
        (team as any).faceitTeamId || '',
        league.championshipId || '',
        league.leagueId || '',
        league.seasonId || '',
        league.stageId || '',
      )
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'clearLeague') {
      await payload.update({
        collection: 'teams',
        id: teamId,
        data: { currentFaceitLeague: null, currentFaceitSeason: null } as any,
        overrideAccess: true,
      })
      invalidateLatestSeasonPlan()
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 })
  } catch (error: any) {
    console.error('[FaceitTeamsOverview] POST error:', error)
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 })
  }
}
