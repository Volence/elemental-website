import type { PlayerRow } from './types'

export function pickStandout(
  players: Pick<PlayerRow, 'name' | 'eliminations' | 'deaths'>[],
): { name: string; eliminations: number; deaths: number } | null {
  let best: { name: string; eliminations: number; deaths: number } | null = null
  for (const pl of players) {
    if (
      !best ||
      pl.eliminations > best.eliminations ||
      (pl.eliminations === best.eliminations && pl.deaths < best.deaths)
    ) {
      best = { name: pl.name, eliminations: pl.eliminations, deaths: pl.deaths }
    }
  }
  return best
}
