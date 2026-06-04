import type { PlayerLine, HeroLine, TeamKey, MatchSummaryData, RoleMatchup } from './types'

export interface LobbyPlayerInfo { team: number | null; assignedRole: string | null; isCaptain: boolean }

function teamFromString(s: string): TeamKey {
  return s.trim().endsWith('2') ? 2 : 1
}

export function aggregatePlayerLines(
  rows: Array<Record<string, any>>,
  lobbyByPerson: Map<number, LobbyPlayerInfo>,
): PlayerLine[] {
  const byPlayer = new Map<string, PlayerLine>()
  for (const r of rows) {
    const key = r.personId != null ? `p:${r.personId}` : `n:${r.player_name}`
    let line = byPlayer.get(key)
    if (!line) {
      const info = r.personId != null ? lobbyByPerson.get(r.personId) : undefined
      line = {
        personId: r.personId ?? null,
        name: r.player_name,
        team: (info?.team as TeamKey) ?? teamFromString(r.player_team),
        assignedRole: info?.assignedRole ?? null,
        isCaptain: info?.isCaptain ?? false,
        eliminations: 0, finalBlows: 0, deaths: 0, assists: 0,
        heroDamage: 0, healing: 0, damageBlocked: 0, ultsUsed: 0, heroes: [],
      }
      byPlayer.set(key, line)
    }
    line.eliminations += r.eliminations
    line.finalBlows += r.final_blows
    line.deaths += r.deaths
    line.assists += r.offensive_assists + r.defensive_assists
    line.heroDamage += r.hero_damage_dealt
    line.healing += r.healing_dealt
    line.damageBlocked += r.damage_blocked
    line.ultsUsed += r.ultimates_used

    let hero = line.heroes.find((h) => h.hero === r.player_hero)
    if (!hero) {
      hero = { hero: r.player_hero, timePlayedSec: 0, eliminations: 0, deaths: 0, heroDamage: 0, healing: 0 }
      line.heroes.push(hero)
    }
    hero.timePlayedSec += r.hero_time_played
    hero.eliminations += r.eliminations
    hero.deaths += r.deaths
    hero.heroDamage += r.hero_damage_dealt
    hero.healing += r.healing_dealt
  }
  for (const line of byPlayer.values()) {
    line.heroes.sort((a, b) => b.timePlayedSec - a.timePlayedSec)
  }
  return [...byPlayer.values()]
}

export function deriveSummary(
  matchEnds: Array<{ round_number: number; team_1_score: number; team_2_score: number; match_time: number }>,
  players: Pick<PlayerLine, 'name' | 'eliminations' | 'deaths'>[],
  mapName: string,
  lobbyNumber: number,
): MatchSummaryData {
  const last = [...matchEnds].sort((a, b) => a.match_time - b.match_time).at(-1)
  const team1Score = last?.team_1_score ?? 0
  const team2Score = last?.team_2_score ?? 0
  const result = team1Score > team2Score ? 'team1' : team2Score > team1Score ? 'team2' : 'draw'
  const durationSec = last?.match_time ?? 0

  let standout: MatchSummaryData['standout'] = null
  for (const p of players) {
    if (
      !standout ||
      p.eliminations > standout.eliminations ||
      (p.eliminations === standout.eliminations && p.deaths < standout.deaths)
    ) {
      standout = { name: p.name, eliminations: p.eliminations, deaths: p.deaths }
    }
  }
  return { lobbyNumber, mapName, durationSec, result, team1Score, team2Score, standout }
}

const ROLE_ORDER = ['tank', 'hitscan-dps', 'flex-dps', 'main-support', 'flex-support']

export function pairRoleMatchups(players: PlayerLine[]): { matchups: RoleMatchup[]; unpaired: PlayerLine[] } {
  const withRole = players.filter((p) => p.assignedRole)
  const unpaired = players.filter((p) => !p.assignedRole)
  const roles = [...new Set(withRole.map((p) => p.assignedRole as string))]
  roles.sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a), ib = ROLE_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  const matchups: RoleMatchup[] = []
  for (const role of roles) {
    const inRole = withRole.filter((p) => p.assignedRole === role)
    const t1 = inRole.filter((p) => p.team === 1)
    const t2 = inRole.filter((p) => p.team === 2)
    const n = Math.max(t1.length, t2.length)
    for (let i = 0; i < n; i++) {
      matchups.push({ role, team1: t1[i] ?? null, team2: t2[i] ?? null })
    }
  }
  return { matchups, unpaired }
}
