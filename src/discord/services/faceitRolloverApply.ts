import type { Payload } from 'payload'
import type { PlannedLeague, RolloverPlan } from '@/utilities/faceitRollover'
import { finalizeLeague } from '@/utilities/faceitFinalize'
import { syncTeamData } from '@/utilities/faceitSync'
import { updateFaceitChannel } from './faceitUpdates'

/**
 * Apply a RolloverPlan in a fixed order: finalize old leagues, create the new
 * templates, move each team (the Teams beforeChange hook retires the old
 * season and creates the new one), tidy playoff flags and stale pointers,
 * sync every moved team, refresh the FACEIT updates channel. Every step is
 * recorded in the report; nothing is retried silently.
 */

export interface RolloverOverrides {
  /** teamId -> stageId of the planned league to use, or null to skip the team */
  [teamId: string]: string | null
}

export interface RolloverReport {
  season: number
  leaguesCreated: number
  leaguesReused: number
  leaguesFinalized: number
  finalizeErrors: string[]
  teamsAssigned: Array<{ teamId: number; teamName: string; league: string }>
  teamsSkipped: Array<{ teamId: number; teamName: string; reason: string }>
  stalePointersCleared: number
  playoffFlagsCleared: number
  sync: Array<{ teamId: number; teamName: string; ok: boolean; matchesCreated: number; matchesUpdated: number; error?: string }>
  errors: string[]
}

let running = false
export function isRolloverRunning(): boolean {
  return running
}

export async function applyRolloverPlan(payload: Payload, plan: RolloverPlan, overrides: RolloverOverrides): Promise<RolloverReport> {
  if (running) throw new Error('A rollover is already running')
  running = true
  const report: RolloverReport = {
    season: plan.season.number,
    leaguesCreated: 0,
    leaguesReused: 0,
    leaguesFinalized: 0,
    finalizeErrors: [],
    teamsAssigned: [],
    teamsSkipped: [],
    stalePointersCleared: 0,
    playoffFlagsCleared: 0,
    sync: [],
    errors: [],
  }
  try {
    // 1. Finalize leftover active leagues from older seasons
    for (const league of plan.finalize) {
      try {
        const full = await payload.findByID({ collection: 'faceit-leagues', id: league.id, depth: 0, overrideAccess: true })
        const r = await finalizeLeague(payload, full as any)
        report.leaguesFinalized++
        report.finalizeErrors.push(...r.errors)
      } catch (err) {
        report.finalizeErrors.push(`${league.name}: ${(err as Error).message}`)
      }
    }

    // 2. Create or reuse league templates
    const leagueIdByKey = new Map<string, number>()
    for (const league of plan.leagues) {
      if (league.existingId) {
        leagueIdByKey.set(league.key, league.existingId)
        report.leaguesReused++
        continue
      }
      try {
        const created = await payload.create({
          collection: 'faceit-leagues',
          data: {
            name: league.name,
            isActive: true,
            seasonNumber: league.seasonNumber,
            division: league.division,
            region: league.region,
            conference: league.conference,
            leagueId: league.leagueId,
            seasonId: league.seasonId,
            stageId: league.stageId,
            championshipId: league.championshipId,
            notes: `Created by season rollover on ${new Date().toISOString().slice(0, 10)}`,
          },
          overrideAccess: true,
        })
        leagueIdByKey.set(league.key, created.id as number)
        report.leaguesCreated++
      } catch (err) {
        report.errors.push(`Create ${league.name}: ${(err as Error).message}`)
      }
    }

    // 3. Move teams. Overrides replace the planned stage (null = skip).
    const leagueByStage = new Map<string, PlannedLeague>(plan.leagues.map((l) => [l.stageId, l]))
    const planned = new Map(plan.assignments.map((a) => [a.teamId, a]))
    const candidateIds = new Set<number>([
      ...plan.assignments.map((a) => a.teamId),
      ...plan.unmatched.map((u) => u.teamId),
      ...plan.conflicts.map((c) => c.teamId),
    ])
    const moves: Array<{ teamId: number; teamName: string; league: PlannedLeague }> = []
    for (const teamId of candidateIds) {
      const name =
        planned.get(teamId)?.teamName ??
        plan.unmatched.find((u) => u.teamId === teamId)?.teamName ??
        plan.conflicts.find((c) => c.teamId === teamId)?.teamName ??
        `Team #${teamId}`
      const override = overrides[String(teamId)]
      const isUnmatched = plan.unmatched.some((u) => u.teamId === teamId)
      const isConflict = plan.conflicts.some((c) => c.teamId === teamId)
      let league: PlannedLeague | undefined
      if (override === null) {
        const reason = isUnmatched
          ? 'Not found in FACEIT registrations (left on Skip)'
          : isConflict
            ? 'Registered in more than one division (left on Skip)'
            : 'Skipped by admin'
        report.teamsSkipped.push({ teamId, teamName: name, reason })
        continue
      } else if (typeof override === 'string') {
        league = leagueByStage.get(override)
        if (!league) {
          report.teamsSkipped.push({ teamId, teamName: name, reason: `Unknown stage ${override}` })
          continue
        }
      } else {
        const a = planned.get(teamId)
        league = a ? plan.leagues.find((l) => l.key === a.toKey) : undefined
        if (!league) {
          const reason = isConflict ? 'Registered in more than one division' : 'Not found in FACEIT registrations'
          report.teamsSkipped.push({ teamId, teamName: name, reason })
          continue
        }
      }
      moves.push({ teamId, teamName: name, league })
    }

    for (const move of moves) {
      const leagueId = leagueIdByKey.get(move.league.key)
      if (!leagueId) {
        report.teamsSkipped.push({ teamId: move.teamId, teamName: move.teamName, reason: `League ${move.league.name} was not created` })
        continue
      }
      try {
        // The Teams beforeChange hook retires the old active season and creates the
        // new one, but only when the incoming data carries faceitEnabled and the
        // team id, so send those along with the league.
        const current = await payload.findByID({ collection: 'teams', id: move.teamId, depth: 0, overrideAccess: true })
        await payload.update({
          collection: 'teams',
          id: move.teamId,
          data: {
            faceitEnabled: true,
            faceitTeamId: (current as any).faceitTeamId,
            currentFaceitLeague: leagueId,
            faceitWithdrawn: false,
          } as any,
          overrideAccess: true,
        })
        report.teamsAssigned.push({ teamId: move.teamId, teamName: move.teamName, league: move.league.name })
      } catch (err) {
        report.errors.push(`Move ${move.teamName}: ${(err as Error).message}`)
      }
    }

    // 4. Playoff flags on inactive seasons are leftovers from the old season
    try {
      const stale = await payload.find({
        collection: 'faceit-seasons',
        where: { and: [{ isActive: { equals: false } }, { inPlayoffs: { equals: true } }] },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })
      for (const s of stale.docs) {
        await payload.update({ collection: 'faceit-seasons', id: s.id, data: { inPlayoffs: false } as any, overrideAccess: true })
        report.playoffFlagsCleared++
      }
    } catch (err) {
      report.errors.push(`Playoff flags: ${(err as Error).message}`)
    }

    // 5. Teams that are not enabled or not active should not point at any league
    for (const stale of plan.stalePointers) {
      try {
        await payload.update({
          collection: 'teams',
          id: stale.teamId,
          data: { currentFaceitLeague: null, currentFaceitSeason: null } as any,
          overrideAccess: true,
        })
        report.stalePointersCleared++
      } catch (err) {
        report.errors.push(`Clear pointer ${stale.teamName}: ${(err as Error).message}`)
      }
    }

    // 6. Sync moved teams, then refresh the Discord channel once
    for (const moved of report.teamsAssigned) {
      const league = plan.leagues.find((l) => l.name === moved.league)
      const team = await payload.findByID({ collection: 'teams', id: moved.teamId, depth: 0, overrideAccess: true }).catch(() => null)
      if (!league || !team) continue
      const r = await syncTeamData(
        moved.teamId,
        (team as any).faceitTeamId || '',
        league.championshipId,
        league.leagueId,
        league.seasonId,
        league.stageId,
      )
      report.sync.push({
        teamId: moved.teamId,
        teamName: moved.teamName,
        ok: r.success,
        matchesCreated: r.matchesCreated || 0,
        matchesUpdated: r.matchesUpdated || 0,
        error: r.success ? undefined : r.error,
      })
      await new Promise((res) => setTimeout(res, 500))
    }
    try {
      await updateFaceitChannel()
    } catch (err) {
      report.errors.push(`FACEIT channel refresh: ${(err as Error).message}`)
    }
  } finally {
    running = false
  }
  console.log(
    `[FaceitRollover] Season ${report.season}: ${report.leaguesCreated} leagues created, ${report.teamsAssigned.length} teams moved, ${report.errors.length} errors`,
  )
  return report
}
