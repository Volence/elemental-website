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

export type ActivityType = 'free' | 'scrim' | 'match' | 'warmup' | 'vod' | 'scouting' | 'other'

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'scrim', label: 'Scrim' },
  { value: 'match', label: 'Match' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'vod', label: 'VOD Review' },
  { value: 'scouting', label: 'Scouting' },
  { value: 'other', label: 'Other' },
]

export const OPPONENT_ACTIVITIES = new Set<string>(['scrim', 'match'])

export function getBlockActivity(block: { activity?: string; scrim?: { isScrim?: boolean; opponent?: string; opponentTeamId?: number | null } }): string {
  if (block.activity) return block.activity
  if (block.scrim?.isScrim || block.scrim?.opponent || block.scrim?.opponentTeamId) return 'scrim'
  return 'free'
}

export interface TimeBlock {
  id: string // Unique ID for React keys
  time: string // e.g., "8-10 EST"
  activity?: ActivityType
  slots: PlayerSlot[]
  scrim?: {
    isScrim?: boolean
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
  /** Per-slot availability from calendar responses (not present for poll-based) */
  timeSlots?: Array<{
    time: string
    voters: Array<{ id: string; username: string; displayName: string }>
  }>
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
