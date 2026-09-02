import { describe, it, expect } from 'vitest'
import {
  dueDateKey,
  dueDateInputValue,
  formatDueDate,
  localDateKey,
  addDays,
  weekBoundsFor,
} from '@/utilities/taskDueDate'

describe('dueDateKey', () => {
  it('uses the UTC calendar date for date-only values stored at UTC midnight', () => {
    // The workboard modal saves "2026-09-06" which Payload stores as UTC midnight.
    // In US timezones new Date(...) would show Sep 5 - we want Sep 6.
    expect(dueDateKey('2026-09-06T00:00:00.000Z')).toBe('2026-09-06')
  })

  it('uses the local calendar date for values that carry a real time', () => {
    const d = new Date(2026, 8, 6, 15, 30) // local Sep 6 15:30
    expect(dueDateKey(d.toISOString())).toBe('2026-09-06')
  })

  it('returns null for empty input', () => {
    expect(dueDateKey(null)).toBeNull()
    expect(dueDateKey(undefined)).toBeNull()
    expect(dueDateKey('')).toBeNull()
  })
})

describe('dueDateInputValue', () => {
  it('feeds a date input the same calendar date the card displays', () => {
    expect(dueDateInputValue('2026-09-06T00:00:00.000Z')).toBe('2026-09-06')
    expect(dueDateInputValue(null)).toBe('')
  })
})

describe('formatDueDate', () => {
  it('formats a date-only due date without timezone drift', () => {
    expect(formatDueDate('2026-09-06T00:00:00.000Z')).toBe('Sep 6')
    expect(formatDueDate('2026-09-06T00:00:00.000Z', { month: '2-digit', day: '2-digit' })).toBe('09/06')
  })
})

describe('localDateKey / addDays / weekBoundsFor', () => {
  it('builds keys from local dates', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('adds days without mutating the input', () => {
    const base = new Date(2026, 8, 30)
    const next = addDays(base, 2)
    expect(localDateKey(next)).toBe('2026-10-02')
    expect(localDateKey(base)).toBe('2026-09-30')
  })

  it('returns a Sunday-to-Saturday week around any date', () => {
    const { start, end } = weekBoundsFor(new Date(2026, 8, 2)) // Wed Sep 2 2026
    expect(localDateKey(start)).toBe('2026-08-30')
    expect(localDateKey(end)).toBe('2026-09-05')
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(23)
  })
})

describe('compareTasksByDueDate', () => {
  it('sorts soonest first, undated last, priority as tiebreaker', async () => {
    const { compareTasksByDueDate } = await import('@/utilities/taskDueDate')
    const tasks = [
      { id: 1, dueDate: null, priority: 'urgent' },
      { id: 2, dueDate: '2026-09-06T00:00:00.000Z', priority: 'low' },
      { id: 3, dueDate: '2026-09-02T00:00:00.000Z', priority: 'medium' },
      { id: 4, dueDate: '2026-09-02T00:00:00.000Z', priority: 'urgent' },
      { id: 5, dueDate: undefined, priority: 'low' },
    ]
    expect([...tasks].sort(compareTasksByDueDate).map((t) => t.id)).toEqual([4, 3, 2, 1, 5])
  })
})
