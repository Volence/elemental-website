import {
  DEPARTMENT_KEYS,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  ROLE_VALUES,
  type AccessFlag,
  type AccessPerson,
  type AccessReport,
  type DepartmentKey,
  type RoleValue,
} from '@/accessReview/types'

export type GroupBand = 'role' | 'department' | 'team'

interface AccessGroupBase {
  key: string
  label: string
  people: AccessPerson[]
}

export type AccessGroup =
  | (AccessGroupBase & { band: 'role'; role: RoleValue })
  | (AccessGroupBase & { band: 'department'; departmentKey: DepartmentKey })
  | (AccessGroupBase & { band: 'team'; teamId: number })

export interface GroupFilter {
  search: string
  flag: AccessFlag | null
}

export const ALL_FLAGS: AccessFlag[] = [
  'team-without-roster',
  'not-in-discord',
  'dormant',
  'no-review-record',
]

export const FLAG_LABELS: Record<AccessFlag, string> = {
  'team-without-roster': 'Team access without roster spot',
  'not-in-discord': 'Not in the Discord server',
  dormant: 'No login in 90 days',
  'no-review-record': 'No access review on record',
}

function matches(person: AccessPerson, filter: GroupFilter): boolean {
  if (filter.flag && !person.flags.includes(filter.flag)) return false
  if (!filter.search) return true
  const needle = filter.search.toLowerCase()
  return (
    person.name.toLowerCase().includes(needle) ||
    (person.email ?? '').toLowerCase().includes(needle)
  )
}

/**
 * Permission-first grouping: one group per role, per department flag, and per team that anyone
 * has data access to. A person appears in every group whose permission they hold. Empty groups
 * are dropped, and the plain `user` role never forms a group - it is the absence of access.
 */
export function buildGroups(report: AccessReport, filter: GroupFilter): AccessGroup[] {
  const people = report.people.filter((person) => matches(person, filter))
  const groups: AccessGroup[] = []

  for (const role of ROLE_VALUES) {
    if (role === 'user') continue
    const members = people.filter((person) => person.role === role)
    if (members.length) {
      groups.push({ key: `role:${role}`, band: 'role', role, label: ROLE_LABELS[role], people: members })
    }
  }

  for (const key of DEPARTMENT_KEYS) {
    const members = people.filter((person) => person.departments.includes(key))
    if (members.length) {
      groups.push({
        key: `department:${key}`,
        band: 'department',
        departmentKey: key,
        label: DEPARTMENT_LABELS[key],
        people: members,
      })
    }
  }

  const teamNames = new Map<number, string>()
  for (const person of people) {
    for (const team of person.teams) teamNames.set(team.teamId, team.teamName)
  }
  const teamIds = [...teamNames.keys()].sort((a, b) =>
    (teamNames.get(a) ?? '').localeCompare(teamNames.get(b) ?? ''),
  )
  for (const teamId of teamIds) {
    const members = people.filter((person) => person.teams.some((team) => team.teamId === teamId))
    if (members.length) {
      groups.push({
        key: `team:${teamId}`,
        band: 'team',
        teamId,
        label: teamNames.get(teamId) ?? `Team #${teamId}`,
        people: members,
      })
    }
  }

  return groups
}

export function countFlags(report: AccessReport): Record<AccessFlag, number> {
  const counts = {
    'team-without-roster': 0,
    'not-in-discord': 0,
    dormant: 0,
    'no-review-record': 0,
  } as Record<AccessFlag, number>

  for (const person of report.people) {
    for (const flag of person.flags) counts[flag] += 1
  }

  return counts
}
