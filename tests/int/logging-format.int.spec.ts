import { describe, it, expect } from 'vitest'
import { ordinal, humanizeDuration } from '@/discord/logging/format'

const D = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  Date.UTC(y, mo - 1, d, h, mi, s)

describe('ordinal', () => {
  it('applies correct suffixes', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(4)).toBe('4th')
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(13)).toBe('13th')
    expect(ordinal(21)).toBe('21st')
  })
  it('adds thousands separators', () => {
    expect(ordinal(2210)).toBe('2,210th')
  })
})

describe('humanizeDuration', () => {
  it('formats calendar years/months/days', () => {
    expect(humanizeDuration(D(2020, 1, 1), D(2023, 4, 15))).toBe('3 years, 3 months and 14 days')
  })
  it('shows two units when only two are non-zero', () => {
    expect(humanizeDuration(0, 5 * 60000 + 47 * 1000)).toBe('5 minutes and 47 seconds')
    expect(humanizeDuration(0, (6 * 3600 + 15 * 60) * 1000)).toBe('6 hours and 15 minutes')
  })
  it('caps at the largest maxUnits non-zero units', () => {
    // 1 day, 2 hours, 3 minutes, 4 seconds -> top 3
    const ms = (24 * 3600 + 2 * 3600 + 3 * 60 + 4) * 1000
    expect(humanizeDuration(0, ms)).toBe('1 day, 2 hours and 3 minutes')
  })
  it('singularizes a single unit', () => {
    expect(humanizeDuration(0, 86400000)).toBe('1 day')
  })
  it('handles a zero gap', () => {
    expect(humanizeDuration(1000, 1000)).toBe('less than a second')
  })
  it('is order-independent (from/to swapped)', () => {
    expect(humanizeDuration(D(2023, 4, 15), D(2020, 1, 1))).toBe('3 years, 3 months and 14 days')
  })
})
