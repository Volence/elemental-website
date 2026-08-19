import {
  DEPARTMENT_KEYS,
  type AccessChangeRecord,
  type AccessFlag,
  type AccessPerson,
  type AccessReport,
  type BuildReportInput,
  type DepartmentKey,
  type RawAccessAudit,
  type RawPerson,
  type RawSession,
  type RawTeam,
  type Relationship,
  type TeamAccess,
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

const DAY_MS = 86_400_000
const DEFAULT_DORMANT_DAYS = 90
const DEFAULT_REVIEW_DAYS = 180

function olderThan(iso: string | null, days: number, now: number): boolean {
  if (!iso) return true
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return true
  return now - at > days * DAY_MS
}

/**
 * Turn raw collection data into the access report. Pure: no Payload, no network, no clock.
 * Everything the page shows or flags is decided here.
 */
export function buildReport(input: BuildReportInput): AccessReport {
  const dormantDays = input.dormantDays ?? DEFAULT_DORMANT_DAYS
  const reviewDays = input.reviewDays ?? DEFAULT_REVIEW_DAYS

  const standingIndex = buildTeamStandingIndex(input.teams)
  const teamNames = new Map(input.teams.map((team) => [team.id, team.name ?? `Team #${team.id}`]))
  const sessionIndex = latestSessionByPerson(input.sessions)
  const auditIndex = latestAccessChangeByPerson(input.accessAudits)

  const people: AccessPerson[] = []

  for (const person of input.people) {
    if (!isElevated(person)) continue

    const teams: TeamAccess[] = []
    for (const entry of person.assignedTeams ?? []) {
      const teamId = relId(entry)
      if (teamId === null) continue
      const embeddedName =
        entry && typeof entry === 'object' ? ((entry.name as string | undefined) ?? null) : null
      teams.push({
        teamId,
        teamName: embeddedName ?? teamNames.get(teamId) ?? `Team #${teamId}`,
        standing: standingIndex.get(teamId)?.get(person.id) ?? null,
      })
    }

    const session = sessionIndex.get(person.id) ?? { lastLoginAt: null, lastActivityAt: null }
    const lastAccessChange = auditIndex.get(person.id) ?? null

    const inDiscord =
      input.discordMemberIds === null || !person.discordId
        ? null
        : input.discordMemberIds.has(person.discordId)

    const flags: AccessFlag[] = []
    if (teams.some((team) => team.standing === null)) flags.push('team-without-roster')
    if (inDiscord === false) flags.push('not-in-discord')
    if (olderThan(session.lastLoginAt, dormantDays, input.now)) flags.push('dormant')
    if (olderThan(lastAccessChange?.at ?? null, reviewDays, input.now)) flags.push('no-review-record')

    people.push({
      id: person.id,
      name: person.name ?? `Person #${person.id}`,
      email: person.email ?? null,
      avatarUrl:
        person.avatar && typeof person.avatar === 'object' ? (person.avatar.url ?? null) : null,
      discordId: person.discordId ?? null,
      role: person.role ?? null,
      departments: activeDepartments(person),
      teams,
      lastLoginAt: session.lastLoginAt,
      lastActivityAt: session.lastActivityAt,
      updatedAt: person.updatedAt ?? null,
      lastAccessChange,
      inDiscord,
      flags,
    })
  }

  people.sort((a, b) => a.name.localeCompare(b.name))

  return {
    generatedAt: new Date(input.now).toISOString(),
    discord: { available: input.discordMemberIds !== null, guildId: input.guildId },
    people,
  }
}
