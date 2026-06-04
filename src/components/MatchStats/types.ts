export type PlayerRow = {
  name: string
  team: string
  hero: string
  role: string
  personId?: number | null
  eliminations: number
  assists: number
  deaths: number
  damage: number
  healing: number
  finalBlows: number
  timePlayed: number
  kd: number
  kad: number
  damageReceived: number
  damageBlocked: number
  healingReceived: number
  selfHealing: number
  soloKills: number
  objectiveKills: number
  multikills: number
  multikillBest: number
  environmentalKills: number
  environmentalDeaths: number
}

export type OverviewTeams = {
  team1: string
  team2: string
  payloadTeamId?: number | null
  payloadTeamId2?: number | null
  isDualTeam?: boolean
}
