import { describe, it, expect } from 'vitest'
import { resolveMapVote } from '../../src/pug/mapVote'

describe('resolveMapVote', () => {
  it('returns the map with the most votes', () => {
    const candidates = [10, 20, 30]
    const votes: Record<number, number> = { 1: 10, 2: 10, 3: 20, 4: 30, 5: 10 }
    expect(resolveMapVote(candidates, votes)).toBe(10)
  })

  it('returns a candidate when nobody votes (random from candidates)', () => {
    const candidates = [10, 20, 30]
    const result = resolveMapVote(candidates, {})
    expect(candidates).toContain(result)
  })

  it('breaks ties by returning a candidate (any of the tied maps)', () => {
    const candidates = [10, 20, 30]
    const votes: Record<number, number> = { 1: 10, 2: 20 }
    const result = resolveMapVote(candidates, votes)
    expect(candidates).toContain(result)
  })
})
