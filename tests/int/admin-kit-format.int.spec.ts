import { describe, it, expect } from 'vitest'
import {
  EMPTY,
  formatDate,
  formatDateShort,
  formatDateTime,
  formatTime,
  formatRelative,
  formatNumber,
  formatPercent,
  formatCompact,
  formatRecord,
  getPersonLabel,
  getInitials,
  withAvatarSize,
} from '@/admin-kit/format'

const ISO = '2026-08-30T23:10:00.000Z'

describe('dates', () => {
  it('formats the standard date shapes', () => {
    expect(formatDate(ISO)).toMatch(/^Aug 3[01], 2026$/)
    expect(formatDateShort(ISO)).toMatch(/^Aug 3[01]$/)
  })

  it('always includes a timezone abbreviation when a time is shown', () => {
    expect(formatTime(ISO)).toMatch(/\d{1,2}:\d{2} [AP]M [A-Z]{2,5}$/)
    expect(formatDateTime(ISO)).toMatch(/^Aug 3[01], 2026, \d{1,2}:\d{2} [AP]M [A-Z]{2,5}$/)
  })

  it('renders EMPTY for missing or invalid input', () => {
    expect(formatDate(null)).toBe(EMPTY)
    expect(formatDate(undefined)).toBe(EMPTY)
    expect(formatDate('')).toBe(EMPTY)
    expect(formatDateTime('not a date')).toBe(EMPTY)
  })
})

describe('formatRelative', () => {
  const now = Date.parse('2026-09-03T12:00:00.000Z')
  it('uses the agreed vocabulary', () => {
    expect(formatRelative('2026-09-03T11:59:40.000Z', now)).toBe('just now')
    expect(formatRelative('2026-09-03T11:55:00.000Z', now)).toBe('5m ago')
    expect(formatRelative('2026-09-03T09:00:00.000Z', now)).toBe('3h ago')
    expect(formatRelative('2026-09-01T12:00:00.000Z', now)).toBe('2d ago')
  })
  it('falls back to the short date past 30 days and says not recorded for null', () => {
    expect(formatRelative('2026-06-01T12:00:00.000Z', now)).toMatch(/^Jun 1$/)
    expect(formatRelative(null, now)).toBe('not recorded')
  })
})

describe('numbers', () => {
  it('formatNumber adds separators and drops decimals', () => {
    expect(formatNumber(12345.6)).toBe('12,346')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(null)).toBe(EMPTY)
  })
  it('formatPercent is an integer 0 to 100 from a ratio or a 0 to 100 value', () => {
    expect(formatPercent(0.573)).toBe('57%')
    expect(formatPercent(57.3, { of100: true })).toBe('57%')
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercent(undefined)).toBe(EMPTY)
  })
  it('formatCompact uses lowercase k and m', () => {
    expect(formatCompact(950)).toBe('950')
    expect(formatCompact(1000)).toBe('1k')
    expect(formatCompact(1234)).toBe('1.2k')
    expect(formatCompact(15000)).toBe('15k')
    expect(formatCompact(1_500_000)).toBe('1.5m')
    expect(formatCompact(-1234)).toBe('-1.2k')
  })
  it('formatRecord is W-L-D with draws always present', () => {
    expect(formatRecord({ w: 3, l: 1, d: 1 })).toBe('3-1-1')
    expect(formatRecord({ w: 3, l: 1 })).toBe('3-1-0')
    expect(formatRecord({})).toBe('0-0-0')
  })
})

describe('people', () => {
  it('getPersonLabel prefers name, then real email, never ids', () => {
    expect(getPersonLabel({ name: 'Jane Doe' })).toBe('Jane Doe')
    expect(getPersonLabel({ name: '  ', email: 'jane@example.com' })).toBe('jane@example.com')
    expect(getPersonLabel({ email: 'discord_123@elmt.placeholder' })).toBe('Unnamed person')
    expect(getPersonLabel(42)).toBe('Unnamed person')
    expect(getPersonLabel(null)).toBe('Unnamed person')
    expect(getPersonLabel({ displayName: 'Mal' })).toBe('Mal')
  })
  it('getInitials returns up to two letters', () => {
    expect(getInitials('Jane Doe')).toBe('JD')
    expect(getInitials('malevolence')).toBe('M')
    expect(getInitials('Jean Luc Picard')).toBe('JP')
    expect(getInitials('')).toBe('?')
    expect(getInitials(null)).toBe('?')
  })
  it('withAvatarSize only touches Discord CDN urls', () => {
    expect(withAvatarSize('https://cdn.discordapp.com/avatars/1/abc.png', 64)).toBe(
      'https://cdn.discordapp.com/avatars/1/abc.png?size=64',
    )
    expect(withAvatarSize('https://cdn.discordapp.com/avatars/1/abc.png?size=1024', 32)).toBe(
      'https://cdn.discordapp.com/avatars/1/abc.png?size=32',
    )
    expect(withAvatarSize('/media/photo.png', 64)).toBe('/media/photo.png')
    expect(withAvatarSize(null, 64)).toBeNull()
  })
})
