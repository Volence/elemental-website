export interface SchedulePerson {
  id: number | string
  name: string
  discordId?: string
  discordAvatar?: string
}

export interface RosterEntry {
  person: SchedulePerson
  role: 'tank' | 'dps' | 'support'
  lastScheduleRole?: string
}

export interface ScheduleTeam {
  id: number
  name: string
  slug: string
  roster: RosterEntry[]
  subs: RosterEntry[]
  scheduleBlocks: { label: string; startTime: string; endTime: string }[]
  scheduleTimezone: string
  rolePreset: 'specific' | 'generic' | 'custom'
  customRoles?: string
  discordThreads: {
    availabilityThreadId?: string
    calendarThreadId?: string
    scheduleThreadId?: string
    scrimCodesThreadId?: string
  }
}

export interface ScheduleAuthState {
  isAuthenticated: boolean
  discordUser?: { id: string; username: string; avatar?: string | null }
  isManager: boolean
  isOnRoster: boolean
  playerId?: string
}

export interface Absence {
  id: number
  person: SchedulePerson | number
  team: number
  type: 'absence' | 'pre-availability'
  startDate: string
  endDate: string
  reason?: string
  selections?: Record<string, Record<string, 'available' | 'maybe'>>
  discordId: string
}

export interface SchedulePageData {
  team: ScheduleTeam
  activeCalendar: any | null
  nextWeekCalendar: any | null
  recentSchedules: any[]
  absences: Absence[]
  authState: ScheduleAuthState
}

export type ScheduleTab = 'availability' | 'calendar' | 'build'
