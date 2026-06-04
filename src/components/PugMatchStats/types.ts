export type TeamKey = 1 | 2

export interface PlayerLine {
  personId: number | null
  name: string
  team: TeamKey
  assignedRole: string | null
  isCaptain: boolean
  eliminations: number
  finalBlows: number
  deaths: number
  assists: number // offensive_assists + defensive_assists
  heroDamage: number
  healing: number
  healingReceived: number
  damageBlocked: number
  ultsUsed: number
  heroes: HeroLine[] // sorted by timePlayed desc
}

export interface HeroLine {
  hero: string
  timePlayedSec: number
  eliminations: number
  deaths: number
  heroDamage: number
  healing: number
}

export interface RoleMatchup {
  role: string
  team1: PlayerLine | null
  team2: PlayerLine | null
}

export interface PugMatchData {
  lobbyNumber: number
  mapName: string
  mapDataId: number
  matchups: RoleMatchup[]
  unpaired: PlayerLine[]
}
