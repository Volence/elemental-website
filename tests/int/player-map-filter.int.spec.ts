import { describe, it, expect } from 'vitest'
import { playedMeaningfully } from '../../src/lib/scrim-parser/player-maps'

// A player subbed out after a second or two leaves a final-round stats row
// with zero across every counting stat. These "phantom" appearances pollute a
// player's map history and drag down per-map averages, so they must be excluded.

function makeRow(
  overrides: Partial<{
    eliminations: number
    final_blows: number
    deaths: number
    hero_damage_dealt: number
    healing_dealt: number
  }> = {},
) {
  return {
    eliminations: 0,
    final_blows: 0,
    deaths: 0,
    hero_damage_dealt: 0,
    healing_dealt: 0,
    ...overrides,
  }
}

describe('playedMeaningfully', () => {
  it('excludes a row with zero of every counting stat (subbed-out phantom)', () => {
    expect(playedMeaningfully(makeRow())).toBe(false)
  })

  it('keeps a row with eliminations', () => {
    expect(playedMeaningfully(makeRow({ eliminations: 3 }))).toBe(true)
  })

  it('keeps a row with only deaths (player was in and died)', () => {
    expect(playedMeaningfully(makeRow({ deaths: 1 }))).toBe(true)
  })

  it('keeps a row with only healing (support contribution)', () => {
    expect(playedMeaningfully(makeRow({ healing_dealt: 1200 }))).toBe(true)
  })

  it('keeps a row with only hero damage', () => {
    expect(playedMeaningfully(makeRow({ hero_damage_dealt: 500 }))).toBe(true)
  })

  it('keeps a row with only final blows', () => {
    expect(playedMeaningfully(makeRow({ final_blows: 1 }))).toBe(true)
  })
})
