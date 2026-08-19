import {
  DEPARTMENT_KEYS,
  type AccessChangeRecord,
  type DepartmentKey,
  type RawAccessAudit,
  type RawPerson,
  type RawSession,
  type RawTeam,
  type Relationship,
  type TeamStanding,
} from './types'

/** Relationship fields arrive as a bare id or a populated object depending on query depth. */
export function relId(value: Relationship<{ id?: unknown }>): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value && typeof value === 'object' && 'id' in value) {
    const id = Number((value as { id: unknown }).id)
    return Number.isFinite(id) ? id : null
  }
  return null
}

export function activeDepartments(person: RawPerson): DepartmentKey[] {
  const departments = person.departments ?? {}
  return DEPARTMENT_KEYS.filter((key) => departments[key] === true)
}

/**
 * In scope for the report: any role other than `user`, any department flag, or any team
 * data access. Players are deliberately included - a stale assignedTeams entry on a Player
 * is the scrim-data leak this page exists to find.
 */
export function isElevated(person: RawPerson): boolean {
  if (person.role && person.role !== 'user') return true
  if (activeDepartments(person).length > 0) return true
  return (person.assignedTeams ?? []).length > 0
}

/** Highest first. A person holding two positions is reported as the more senior one. */
const STANDING_PRECEDENCE: TeamStanding[] = [
  'manager',
  'coach',
  'captain',
  'co-captain',
  'roster',
  'sub',
]

/** teamId -> personId -> the position they hold on that team. */
export function buildTeamStandingIndex(teams: RawTeam[]): Map<number, Map<number, TeamStanding>> {
  const index = new Map<number, Map<number, TeamStanding>>()

  for (const team of teams) {
    const standings = new Map<number, TeamStanding>()

    const record = (personId: number | null, standing: TeamStanding): void => {
      if (personId === null) return
      const existing = standings.get(personId)
      if (
        existing &&
        STANDING_PRECEDENCE.indexOf(existing) <= STANDING_PRECEDENCE.indexOf(standing)
      ) {
        return
      }
      standings.set(personId, standing)
    }

    for (const row of team.manager ?? []) record(relId(row?.person), 'manager')
    for (const row of team.coaches ?? []) record(relId(row?.person), 'coach')
    for (const row of team.captain ?? []) record(relId(row?.person), 'captain')
    record(relId(team.coCaptain), 'co-captain')
    for (const row of team.roster ?? []) record(relId(row?.person), 'roster')
    for (const row of team.subs ?? []) record(relId(row?.person), 'sub')

    index.set(team.id, standings)
  }

  return index
}

export interface SessionSummary {
  lastLoginAt: string | null
  lastActivityAt: string | null
}

/**
 * Newest login and newest activity per person. ActiveSessions rows are flipped to
 * isActive:false on logout rather than deleted, so this covers historical sessions too.
 * Payload stores dates as ISO UTC strings, which compare correctly with `>`.
 */
export function latestSessionByPerson(sessions: RawSession[]): Map<number, SessionSummary> {
  const map = new Map<number, SessionSummary>()

  for (const session of sessions) {
    const personId = relId(session.user)
    if (personId === null) continue

    const current = map.get(personId) ?? { lastLoginAt: null, lastActivityAt: null }
    if (session.loginTime && (!current.lastLoginAt || session.loginTime > current.lastLoginAt)) {
      current.lastLoginAt = session.loginTime
    }
    if (
      session.lastActivity &&
      (!current.lastActivityAt || session.lastActivity > current.lastActivityAt)
    ) {
      current.lastActivityAt = session.lastActivity
    }
    map.set(personId, current)
  }

  return map
}

/**
 * Newest access-field change per person, from audit entries written by the People audit hook.
 * Entries whose metadata lists no access field are skipped - a bio edit is not a review.
 */
export function latestAccessChangeByPerson(
  audits: RawAccessAudit[],
): Map<number, AccessChangeRecord> {
  const map = new Map<number, AccessChangeRecord>()

  for (const entry of audits) {
    const fields = entry.metadata?.accessFields ?? []
    if (!fields.length) continue

    const personId = Number(entry.documentId)
    if (!Number.isFinite(personId)) continue

    const existing = map.get(personId)
    if (existing && existing.at >= entry.createdAt) continue

    const byName =
      entry.user && typeof entry.user === 'object' ? ((entry.user.name as string) ?? null) : null

    map.set(personId, { at: entry.createdAt, byName, fields })
  }

  return map
}
