import type { LiveSnapshot, LiveDiff, LiveActivityEvent, TeamKey } from './types'

const FLASH_STATS = ['eliminations', 'finalBlows', 'deaths', 'heroDamage', 'healingDealt', 'ultimatesUsed'] as const

export function diffSnapshots(prev: LiveSnapshot | null, next: LiveSnapshot): LiveDiff {
  const changed = new Set<string>()
  const activity: LiveActivityEvent[] = []

  const teams: Array<[TeamKey, LiveSnapshot['team1']]> = [[1, next.team1], [2, next.team2]]
  const prevTeams = prev ? { 1: prev.team1, 2: prev.team2 } : null

  for (const [tk, team] of teams) {
    for (const [name, p] of Object.entries(team.players)) {
      const before = prevTeams ? prevTeams[tk].players[name] : undefined
      if (!before) continue
      for (const stat of FLASH_STATS) {
        if ((p as any)[stat] > (before as any)[stat]) changed.add(`${tk}:${name}:${stat}`)
      }
      if (p.finalBlows > before.finalBlows) activity.push({ kind: 'kill', player: name, team: tk })
      if (p.deaths > before.deaths) activity.push({ kind: 'death', player: name, team: tk })
    }
  }

  const leaders = { elims: leaderBy(next, 'eliminations'), damage: leaderBy(next, 'heroDamage'), healing: leaderBy(next, 'healingDealt') }
  return { changed, activity, leaders }
}

function leaderBy(s: LiveSnapshot, stat: 'eliminations' | 'heroDamage' | 'healingDealt'): string | null {
  let best: string | null = null
  let bestVal = -1
  for (const team of [s.team1, s.team2]) {
    for (const [name, p] of Object.entries(team.players)) {
      const v = p[stat] as number
      if (v > bestVal) { bestVal = v; best = name }
    }
  }
  return bestVal > 0 ? best : null
}
