/** The eight department checkboxes on People.departments, in the order the editor shows them. */
export const DEPARTMENT_KEYS = [
  'isProductionStaff',
  'isSocialMediaStaff',
  'isGraphicsStaff',
  'isVideoStaff',
  'isEventsStaff',
  'isScoutingStaff',
  'isContentCreator',
  'isPugAdmin',
] as const

export type DepartmentKey = (typeof DEPARTMENT_KEYS)[number]

export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  isProductionStaff: 'Production',
  isSocialMediaStaff: 'Social Media',
  isGraphicsStaff: 'Graphics',
  isVideoStaff: 'Video Editing',
  isEventsStaff: 'Events',
  isScoutingStaff: 'Scouting',
  isContentCreator: 'Content Creator',
  isPugAdmin: 'PUG Admin',
}

export const ROLE_VALUES = ['admin', 'staff-manager', 'team-manager', 'player', 'user'] as const
export type RoleValue = (typeof ROLE_VALUES)[number]

export const ROLE_LABELS: Record<RoleValue, string> = {
  admin: 'Admin',
  'staff-manager': 'Staff Manager',
  'team-manager': 'Team Manager',
  player: 'Player',
  user: 'User',
}

/** Position a person actually holds on a team. null means they hold none. */
export type TeamStanding = 'manager' | 'coach' | 'captain' | 'co-captain' | 'roster' | 'sub'

export interface TeamAccess {
  teamId: number
  teamName: string
  /** null when the person has data access to this team without holding any position on it. */
  standing: TeamStanding | null
}

export type AccessFlag = 'team-without-roster' | 'not-in-discord' | 'dormant' | 'no-review-record'

export interface AccessChangeRecord {
  at: string
  byName: string | null
  fields: string[]
}

export interface AccessPerson {
  id: number
  name: string
  email: string | null
  avatarUrl: string | null
  discordId: string | null
  role: string | null
  /** Only the department keys currently set to true. */
  departments: DepartmentKey[]
  teams: TeamAccess[]
  lastLoginAt: string | null
  lastActivityAt: string | null
  /** Any edit to the person, not just access. Weak signal, labelled as such in the UI. */
  updatedAt: string | null
  lastAccessChange: AccessChangeRecord | null
  /** true in guild, false definitely not, null unknown (no discordId, or bot unavailable). */
  inDiscord: boolean | null
  flags: AccessFlag[]
}

export interface AccessReport {
  generatedAt: string
  discord: { available: boolean; guildId: string | null }
  people: AccessPerson[]
}

// -- Inputs to the pure computation. Deliberately plain so tests need no database. --

export type Relationship<T> = T | number | null | undefined

export interface RawPerson {
  id: number
  name?: string | null
  email?: string | null
  role?: string | null
  discordId?: string | null
  avatar?: Relationship<{ url?: string | null }>
  departments?: Record<string, boolean | null | undefined> | null
  assignedTeams?: Array<Relationship<{ id: number; name?: string | null }>> | null
  updatedAt?: string | null
}

export interface RawTeamMemberRow {
  person?: Relationship<{ id: number }>
}

export interface RawTeam {
  id: number
  name?: string | null
  manager?: RawTeamMemberRow[] | null
  coaches?: RawTeamMemberRow[] | null
  captain?: RawTeamMemberRow[] | null
  coCaptain?: Relationship<{ id: number }>
  roster?: RawTeamMemberRow[] | null
  subs?: RawTeamMemberRow[] | null
}

export interface RawSession {
  user?: Relationship<{ id: number }>
  loginTime?: string | null
  lastActivity?: string | null
}

export interface RawAccessAudit {
  documentId?: string | number | null
  createdAt: string
  user?: Relationship<{ name?: string | null }>
  metadata?: { accessFields?: string[] } | null
}

export interface BuildReportInput {
  people: RawPerson[]
  teams: RawTeam[]
  sessions: RawSession[]
  accessAudits: RawAccessAudit[]
  /** null means the Discord check could not run. Never treat null as "not a member". */
  discordMemberIds: Set<string> | null
  guildId: string | null
  now: number
  dormantDays?: number
  reviewDays?: number
}
