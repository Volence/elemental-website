import { describe, it, expect } from 'vitest'
import {
  assessConfidence,
  isSufficientConfidence,
} from '../../src/lib/scrim-parser/confidence'

/**
 * Confidence labels tell a reader how much data backs an aggregate stat so they
 * don't over-read a 3-map sample. Sample size is the number of maps. Ported from
 * parsertime (MIT) - thresholds: high>=20, medium>=10, low>=5, else insufficient.
 */
describe('assessConfidence - levels by sample size', () => {
  it('rates 20+ maps as high confidence', () => {
    expect(assessConfidence(20).level).toBe('high')
    expect(assessConfidence(50).level).toBe('high')
  })

  it('rates 10-19 maps as medium confidence', () => {
    expect(assessConfidence(10).level).toBe('medium')
    expect(assessConfidence(19).level).toBe('medium')
  })

  it('rates 5-9 maps as low confidence', () => {
    expect(assessConfidence(5).level).toBe('low')
    expect(assessConfidence(9).level).toBe('low')
  })

  it('rates fewer than 5 maps as insufficient', () => {
    expect(assessConfidence(4).level).toBe('insufficient')
    expect(assessConfidence(0).level).toBe('insufficient')
  })
})

describe('assessConfidence - human-readable label', () => {
  it('reports "No data available" for zero maps', () => {
    expect(assessConfidence(0).label).toBe('No data available')
  })

  it('uses singular "map" for a sample of 1', () => {
    expect(assessConfidence(1).label).toBe('Based on 1 map')
  })

  it('uses plural "maps" for samples above 1', () => {
    expect(assessConfidence(7).label).toBe('Based on 7 maps')
  })
})

describe('assessConfidence - custom thresholds', () => {
  it('honors caller-provided thresholds and reports the low bar as minimumRequired', () => {
    const m = assessConfidence(3, { high: 6, medium: 4, low: 2 })
    expect(m.level).toBe('low')
    expect(m.minimumRequired).toBe(2)
  })
})

describe('isSufficientConfidence', () => {
  it('is false only for insufficient samples', () => {
    expect(isSufficientConfidence(assessConfidence(4))).toBe(false)
    expect(isSufficientConfidence(assessConfidence(5))).toBe(true)
  })
})
