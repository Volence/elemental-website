import { describe, it, expect } from 'vitest'
import { normalizeName, similarity, scoreNames, rankCandidates, MATCH_MIN } from '@/identity/match'

describe('normalizeName', () => {
  it('lowercases and strips non-alphanumerics', () => {
    expect(normalizeName(' Vol_ence#1234 ')).toBe('volence1234')
  })
  it('drops a battletag discriminator when asked', () => {
    expect(normalizeName('Volence#1234', { stripBattletag: true })).toBe('volence')
  })
})

describe('similarity', () => {
  it('is 1 for identical names after normalization', () => {
    expect(similarity('Volence', 'volence')).toBe(1)
  })
  it('is 0.8 for a prefix or containment', () => {
    expect(similarity('Volence', 'volence_ow')).toBe(0.8)
    expect(similarity('ence', 'Volence')).toBe(0.8)
  })
  it('falls back to Levenshtein ratio', () => {
    expect(similarity('kitten', 'sitting')).toBeCloseTo(4 / 7, 5)
  })
  it('is 0 when either side is empty', () => {
    expect(similarity('', 'x')).toBe(0)
  })
})

describe('scoreNames', () => {
  it('returns the best pairwise score', () => {
    expect(scoreNames(['Steve', 'Volence'], ['volence', 'someone'])).toBe(1)
  })
  it('ignores empty and null-ish entries', () => {
    expect(scoreNames(['', 'Volence'], ['', 'volence'])).toBe(1)
  })
})

describe('rankCandidates', () => {
  const people = [
    { id: 1, name: 'Volence', aliases: ['Vol'] },
    { id: 2, name: 'Volentia', aliases: [] },
    { id: 3, name: 'Zed', aliases: [] },
    { id: 4, name: 'volence_ow', aliases: [] },
  ]
  it('returns matches above the minimum, best first, capped at the limit', () => {
    const ranked = rankCandidates(people, (p) => [p.name, ...p.aliases], ['Volence'])
    expect(ranked.map((r) => r.item.id)).toEqual([1, 4, 2])
    expect(ranked[0].score).toBe(1)
    expect(ranked.every((r) => r.score >= MATCH_MIN)).toBe(true)
  })
  it('respects a custom limit', () => {
    expect(rankCandidates(people, (p) => [p.name], ['Volence'], { limit: 1 })).toHaveLength(1)
  })
})
