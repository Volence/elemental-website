import {
  DEPARTMENT_KEYS,
  type DepartmentKey,
  type RawPerson,
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
