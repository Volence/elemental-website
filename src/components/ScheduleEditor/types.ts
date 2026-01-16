/**
 * Shared types for Schedule Editor components
 * Extracted for reuse across sub-components
 */

export interface PlayerSlot {
  role: string
  playerId: string | null
  isRinger?: boolean
  ringerName?: string
}

export interface TimeBlock {
  id: string // Unique ID for React keys
  time: string // e.g., "8-10 EST"
  slots: PlayerSlot[]
  scrim?: {
    opponentTeamId?: number | null
    opponent: string
    opponentRoster: string
    contact: string
    host: 'us' | 'them' | ''
    mapPool: string
    heroBans: boolean
    staggers: boolean
    notes: string
  }
  reminderPosted?: boolean
  // Scrim outcome fields
  outcome?: TimeBlockOutcome
}

export interface TimeBlockOutcome {
  ourRating?: 'easywin' | 'closewin' | 'neutral' | 'closeloss' | 'gotrolled'
  opponentRating?: 'weak' | 'average' | 'strong' | 'verystrong'
  worthScrimAgain?: 'yes' | 'maybe' | 'no'
  mapsPlayed?: Array<{
    mapName: string
    result: 'win' | 'loss' | 'draw'
    score?: string
  }>
  scrimNotes?: string
}

export interface VoteData {
  date: string
  voterCount: number
  voters: Array<{
    id: string
    username: string
    displayName: string
  }>
  roleBreakdown?: Record<string, number> | null
}

export interface DaySchedule {
  date: string
  enabled: boolean
  useAllMembers?: boolean
  blocks: TimeBlock[]
  slots?: PlayerSlot[]
  extraPlayers?: string[]
  scrim?: LegacyScrim
  reminderPosted?: boolean
}

export interface LegacyScrim {
  opponentTeamId?: number | null
  opponent: string
  opponentRoster: string
  contact: string
  time?: string
  host: 'us' | 'them' | ''
  mapPool: string
  heroBans: boolean
  staggers: boolean
  notes: string
}

export interface ScheduleData {
  days: DaySchedule[]
  lastUpdated?: string
}
