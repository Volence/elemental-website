import type { PlayerLine, HeroLine, TeamKey } from './types'

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
