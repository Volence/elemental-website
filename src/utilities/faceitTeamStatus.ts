/**
 * One status per team for the FACEIT teams overview. Pure, so the ordering
 * of checks (the first problem wins) is testable.
 */

export interface FaceitOverviewLeague {
  id: number
  name: string
  isActive: boolean
  seasonNumber: number | null
}

export interface FaceitTeamRow {
  id: number
  name: string
  region: string | null
  active: boolean
  faceitEnabled: boolean
  faceitTeamId: string | null
  faceitWithdrawn: boolean
  league: FaceitOverviewLeague | null
  season: { id: number; isActive: boolean; lastSynced: string | null } | null
  /** What FACEIT's registration lists say for the latest season */
  registration: 'registered' | 'not-registered' | 'conflict' | 'unknown'
  registeredLeague: string | null
  suggestions: Array<{ faceitTeamId: string; faceitName: string; leagueName: string; leagueId: number | null }>
}

export type FaceitStatusCode =
  | 'ok'
  | 'disabled'
  | 'withdrawn'
  | 'stale-pointer'
  | 'no-id'
  | 'no-league'
  | 'old-season'
  | 'not-registered'
  | 'conflict'
  | 'wrong-league'
  | 'never-synced'

export type FaceitStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

export interface FaceitTeamStatus {
  code: FaceitStatusCode
  label: string
  tone: FaceitStatusTone
}

const ATTENTION: ReadonlySet<FaceitStatusCode> = new Set([
  'stale-pointer',
  'no-id',
  'no-league',
  'old-season',
  'not-registered',
  'conflict',
  'wrong-league',
  'never-synced',
])

export function needsAttention(status: FaceitTeamStatus): boolean {
  return ATTENTION.has(status.code)
}

export function faceitTeamStatus(row: FaceitTeamRow, latestSeasonNumber: number | null): FaceitTeamStatus {
  if (!row.faceitEnabled) {
    if (row.league) return { code: 'stale-pointer', label: `FaceIt off but still on ${row.league.name}`, tone: 'warning' }
    return { code: 'disabled', label: 'FaceIt off', tone: 'neutral' }
  }
  if (row.faceitWithdrawn) return { code: 'withdrawn', label: 'Withdrawn this season', tone: 'neutral' }
  if (!row.faceitTeamId) return { code: 'no-id', label: 'No FACEIT team id', tone: 'danger' }
  if (!row.league) return { code: 'no-league', label: 'No league', tone: 'danger' }
  if (!row.league.isActive || (latestSeasonNumber != null && (row.league.seasonNumber ?? 0) < latestSeasonNumber)) {
    return { code: 'old-season', label: `On ${row.league.name}`, tone: 'warning' }
  }
  if (row.registration === 'not-registered') return { code: 'not-registered', label: 'Not in FACEIT registrations', tone: 'warning' }
  if (row.registration === 'conflict') return { code: 'conflict', label: 'Registered in two divisions', tone: 'warning' }
  if (row.registration === 'registered' && row.registeredLeague && row.registeredLeague !== row.league.name) {
    return { code: 'wrong-league', label: `FACEIT has it in ${row.registeredLeague}`, tone: 'warning' }
  }
  if (!row.season || !row.season.lastSynced) return { code: 'never-synced', label: 'Never synced', tone: 'warning' }
  return { code: 'ok', label: 'OK', tone: 'success' }
}
