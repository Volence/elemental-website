export interface LivePlayerStats {
  team: string
  hero: string
  eliminations: number
  finalBlows: number
  deaths: number
  damageDelt: number
  heroDamage: number
  barrierDamage: number
  healingDealt: number
  ultimatesEarned: number
  ultimatesUsed: number
}

export interface LiveTeam {
  name: string
  score: number
  players: Record<string, LivePlayerStats>
}

export interface LiveSnapshot {
  map: string | null
  mapType: string | null
  team1: LiveTeam
  team2: LiveTeam
  round: number
  matchTime: number
  matchEnded: boolean
  matchResult: 'team1' | 'team2' | 'draw' | null
  eventCount: number
}

export type TeamKey = 1 | 2
export interface LiveActivityEvent { kind: 'kill' | 'death'; player: string; team: TeamKey }
export interface LiveLeaders { elims: string | null; damage: string | null; healing: string | null }
export interface LiveDiff {
  changed: Set<string> // `${teamKey}:${playerName}:${stat}`
  activity: LiveActivityEvent[]
  leaders: LiveLeaders
}
