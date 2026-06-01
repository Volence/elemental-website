import { describe, it, expect } from 'vitest'
import { sumStatByRound, type RoundStatInput } from '../../src/lib/scrim-parser/round-stats'

/**
 * ScrimPlayerStat rows store CUMULATIVE match totals per (player, hero), carried
 * forward every round (verified against live data: a player's hero_damage_dealt
 * climbs 305 -> 1231 -> 2326 across rounds, and every hero the player touched
 * gets a row each round). sumStatByRound converts those cumulative snapshots into
 * per-round increments by diffing consecutive rounds.
 *
 * Adapted from parsertime (MIT). parsertime deduped by `${round}-${hero}`, which
 * silently drops a second player on the same hero in the same round; we key on
 * (round, player, hero) so team-level sums stay correct.
 */

// One player on Lúcio (real cumulative damage) plus a 0-damage Mizuki row each
// round - mirrors the real data shape (every touched hero carried forward).
const SINGLE_PLAYER: RoundStatInput[] = [
  { round_number: 2, player_name: 'Morlock', player_hero: 'Lúcio', hero_damage_dealt: 305 },
  { round_number: 2, player_name: 'Morlock', player_hero: 'Mizuki', hero_damage_dealt: 0 },
  { round_number: 3, player_name: 'Morlock', player_hero: 'Lúcio', hero_damage_dealt: 1231.39 },
  { round_number: 3, player_name: 'Morlock', player_hero: 'Mizuki', hero_damage_dealt: 0 },
  { round_number: 4, player_name: 'Morlock', player_hero: 'Lúcio', hero_damage_dealt: 2326.39 },
  { round_number: 4, player_name: 'Morlock', player_hero: 'Mizuki', hero_damage_dealt: 0 },
]

describe('sumStatByRound - cumulative to per-round increments', () => {
  it('diffs consecutive cumulative rounds (first round counts against 0)', () => {
    const out = sumStatByRound(SINGLE_PLAYER, 'hero_damage_dealt')
    expect(out.map((r) => r.round_number)).toEqual([2, 3, 4])
    expect(out[0].value).toBeCloseTo(305, 2) // 305 - 0
    expect(out[1].value).toBeCloseTo(926.39, 2) // 1231.39 - 305
    expect(out[2].value).toBeCloseTo(1095, 2) // 2326.39 - 1231.39
  })

  it('sums increments across multiple players within a round', () => {
    const rows: RoundStatInput[] = [
      { round_number: 1, player_name: 'A', player_hero: 'Ana', hero_damage_dealt: 100 },
      { round_number: 1, player_name: 'B', player_hero: 'Ashe', hero_damage_dealt: 200 },
      { round_number: 2, player_name: 'A', player_hero: 'Ana', hero_damage_dealt: 250 }, // +150
      { round_number: 2, player_name: 'B', player_hero: 'Ashe', hero_damage_dealt: 500 }, // +300
    ]
    const out = sumStatByRound(rows, 'hero_damage_dealt')
    expect(out[0].value).toBeCloseTo(300, 2) // round 1: 100 + 200
    expect(out[1].value).toBeCloseTo(450, 2) // round 2 increments: 150 + 300
  })

  it('counts two players on the same hero in the same round separately', () => {
    // The naive (round, hero) dedup would keep only one of these.
    const rows: RoundStatInput[] = [
      { round_number: 1, player_name: 'A', player_hero: 'Lúcio', hero_damage_dealt: 100 },
      { round_number: 1, player_name: 'B', player_hero: 'Lúcio', hero_damage_dealt: 200 },
    ]
    const out = sumStatByRound(rows, 'hero_damage_dealt')
    expect(out[0].value).toBeCloseTo(300, 2)
  })

  it('returns an empty array for no rows', () => {
    expect(sumStatByRound([], 'hero_damage_dealt')).toEqual([])
  })
})
