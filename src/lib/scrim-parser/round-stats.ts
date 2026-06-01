/**
 * Per-round stat deltas from cumulative ScrimPlayerStat snapshots.
 *
 * ScrimPlayerStat rows hold CUMULATIVE match totals per (player, hero), carried
 * forward every round. To show what happened *in* a given round we diff each
 * round's summed total against the previous round's.
 *
 * Adapted from parsertime (MIT). Two deliberate changes:
 *  - dedup key is (round, player, hero), not (round, hero): two players on the
 *    same hero in one round must both count toward the team total.
 *  - returns a plain { round_number, value } instead of a dynamically-keyed
 *    object, which is simpler for callers to consume.
 */

export type RoundStatInput = Record<string, number | string> & {
  round_number: number
  player_name: string
  player_hero: string
}

/**
 * Sum a cumulative stat per round (one contribution per player+hero) and return
 * the round-over-round increment. The earliest present round is diffed against 0.
 *
 * Generic over the row type so Prisma `ScrimPlayerStat` selections can be passed
 * directly; `key` must name a column on those rows.
 */
export function sumStatByRound<
  T extends { round_number: number; player_name: string; player_hero: string },
>(stats: T[], key: keyof T & string): { round_number: number; value: number }[] {
  const cumulativeByRound = new Map<number, number>()
  const seen = new Set<string>()

  for (const stat of stats) {
    const dedupKey = `${stat.round_number}-${stat.player_name}-${stat.player_hero}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    const value = Number(stat[key]) || 0
    cumulativeByRound.set(
      stat.round_number,
      (cumulativeByRound.get(stat.round_number) ?? 0) + value,
    )
  }

  const result: { round_number: number; value: number }[] = []
  let previous = 0
  for (const round_number of Array.from(cumulativeByRound.keys()).sort((a, b) => a - b)) {
    const cumulative = cumulativeByRound.get(round_number)!
    result.push({ round_number, value: cumulative - previous })
    previous = cumulative
  }

  return result
}
