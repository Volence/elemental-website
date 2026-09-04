export type PugRole = 'tank' | 'flex_dps' | 'hitscan_dps' | 'flex_support' | 'main_support'
export type PugTier = 'open' | 'invite'
export type PugRegion = 'na' | 'emea' | 'pacific' | 'sa'

export const PUG_REGIONS = [
  { value: 'na' as const, label: 'NA' },
  { value: 'emea' as const, label: 'EMEA' },
  { value: 'pacific' as const, label: 'Pacific' },
  { value: 'sa' as const, label: 'SA' },
] as const

export const VALID_REGIONS = PUG_REGIONS.map((r) => r.value)

export function isPugRegion(value: unknown): value is PugRegion {
  return typeof value === 'string' && VALID_REGIONS.includes(value as PugRegion)
}

export const PUG_REGION_LABELS: Record<PugRegion, string> = Object.fromEntries(
  PUG_REGIONS.map((r) => [r.value, r.label]),
) as Record<PugRegion, string>

export function pugRegionLabel(region: string | null | undefined): string {
  return (region && PUG_REGION_LABELS[region as PugRegion]) || (region ?? '').toUpperCase()
}

/** Human list for error messages: "na, emea, pacific or sa". */
export const PUG_REGION_LIST = `${VALID_REGIONS.slice(0, -1).join(', ')} or ${VALID_REGIONS[VALID_REGIONS.length - 1]}`
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
