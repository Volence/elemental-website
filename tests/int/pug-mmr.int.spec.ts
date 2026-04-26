import { describe, it, expect } from 'vitest'
import { calculateRatingUpdates } from '../../src/pug/mmr'
import type { PlayerRating } from '../../src/pug/types'

function makeRating(id: number, rating = 1500, rd = 350, vol = 0.06): PlayerRating {
  return { payloadPlayerId: id, rating, ratingDeviation: rd, volatility: vol }
}

describe('calculateRatingUpdates', () => {
  it('increases winners ratings and decreases losers ratings', () => {
    const winners = [1, 2, 3, 4, 5].map((id) => makeRating(id))
    const losers = [6, 7, 8, 9, 10].map((id) => makeRating(id))
    const updates = calculateRatingUpdates(winners, losers, 'team1')

    for (const w of winners) {
      const updated = updates.find((u) => u.payloadPlayerId === w.payloadPlayerId)!
      expect(updated.rating).toBeGreaterThan(w.rating)
    }
    for (const l of losers) {
      const updated = updates.find((u) => u.payloadPlayerId === l.payloadPlayerId)!
      expect(updated.rating).toBeLessThan(l.rating)
    }
  })

  it('makes minimal changes on a draw', () => {
    const team1 = [1, 2, 3, 4, 5].map((id) => makeRating(id))
    const team2 = [6, 7, 8, 9, 10].map((id) => makeRating(id))
    const updates = calculateRatingUpdates(team1, team2, 'draw')

    for (const u of updates) {
      const original = [...team1, ...team2].find((p) => p.payloadPlayerId === u.payloadPlayerId)!
      expect(Math.abs(u.rating - original.rating)).toBeLessThan(50)
    }
  })

  it('returns 10 updated ratings (one per player)', () => {
    const team1 = [1, 2, 3, 4, 5].map((id) => makeRating(id))
    const team2 = [6, 7, 8, 9, 10].map((id) => makeRating(id))
    const updates = calculateRatingUpdates(team1, team2, 'team1')
    expect(updates).toHaveLength(10)
  })
})
