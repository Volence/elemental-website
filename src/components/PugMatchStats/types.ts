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

export interface HeroSwap {
  matchTimeSec: number
  player: string
  team: TeamKey
  fromHero: string
  toHero: string
}

export interface KillEvent {
  matchTimeSec: number
  attacker: string
  attackerTeam: TeamKey
  attackerHero: string
  victim: string
  victimTeam: TeamKey
  victimHero: string
  ability: string
  isCrit: boolean
  isEnvironmental: boolean
}

export interface UltEvent {
  matchTimeSec: number
  player: string
  team: TeamKey
  hero: string
}

export interface MatchSummaryData {
  lobbyNumber: number
  mapName: string
  durationSec: number
  result: 'team1' | 'team2' | 'draw'
  team1Score: number
  team2Score: number
  standout: { name: string; eliminations: number; deaths: number } | null
}

export interface RoleMatchup {
  role: string
  team1: PlayerLine | null
  team2: PlayerLine | null
}

export interface MatchStats {
  summary: MatchSummaryData
  players: PlayerLine[]
  matchups: RoleMatchup[]
  unpaired: PlayerLine[] // players with no role mirror
  kills: KillEvent[]
  ults: UltEvent[]
  heroSwaps: HeroSwap[]
}
