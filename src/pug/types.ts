export type PugRole = 'tank' | 'flex-dps' | 'hitscan-dps' | 'flex-support' | 'main-support'
export type PugTier = 'open' | 'invite'
export type PugLobbyStatus =
  | 'OPEN'
  | 'READY'
  | 'DRAFTING'
  | 'MAP_VOTE'
  | 'BANNING'
  | 'IN_PROGRESS'
  | 'REPORTING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'

export type QueuedPlayer = {
  userId: number
  queuedRoles: PugRole[]
  rating: number
}

export type AssignedPlayer = {
  userId: number
  assignedRole: PugRole
  team: 1 | 2 | null
  isCaptain: boolean
  rating: number
}

export type DraftPick = {
  userId: number
  team: 1 | 2
  pickNumber: number
}

export type BanRecord = {
  heroId: number
  team: 1 | 2
  banNumber: number
}

export type MapVotes = Record<number, number>

export type MatchResult = 'team1' | 'team2' | 'draw' | 'cancelled'

export type PlayerRating = {
  payloadPlayerId: number
  rating: number
  ratingDeviation: number
  volatility: number
}
