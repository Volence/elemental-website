import { describe, it, expect } from 'vitest'
import { priorityFilterMatches, PRIORITY_LABELS } from '@/components/WorkboardKanban/constants'
import { dueTimeInputValue, composeDueDate, formatDueDateTime } from '@/utilities/taskDueDate'

describe('priorityFilterMatches', () => {
  it('"high+" includes urgent, "medium+" excludes only low', () => {
    expect(priorityFilterMatches('high+', 'urgent')).toBe(true)
    expect(priorityFilterMatches('high+', 'high')).toBe(true)
    expect(priorityFilterMatches('high+', 'medium')).toBe(false)
    expect(priorityFilterMatches('medium+', 'low')).toBe(false)
    expect(priorityFilterMatches('medium+', 'medium')).toBe(true)
    expect(priorityFilterMatches('urgent', 'high')).toBe(false)
    expect(priorityFilterMatches('all', 'low')).toBe(true)
    expect(priorityFilterMatches('medium+', undefined)).toBe(true) // default priority is medium
  })
  it('has a label for every priority', () => {
    expect(Object.keys(PRIORITY_LABELS).sort()).toEqual(['high', 'low', 'medium', 'urgent'])
  })
})

describe('due time helpers', () => {
  it('reads no time from a date-only value and HH:MM from a timed one', () => {
    expect(dueTimeInputValue('2026-09-06T00:00:00.000Z')).toBe('')
    const local = new Date(2026, 8, 6, 15, 30)
    expect(dueTimeInputValue(local.toISOString())).toBe('15:30')
    expect(dueTimeInputValue(null)).toBe('')
  })

  it('composes a date-only string when no time is given, and a local instant when it is', () => {
    expect(composeDueDate('2026-09-06', '')).toBe('2026-09-06')
    expect(composeDueDate('', '10:00')).toBeNull()
    const iso = composeDueDate('2026-09-06', '15:30')!
    const d = new Date(iso)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(6)
    expect(d.getHours()).toBe(15)
    expect(d.getMinutes()).toBe(30)
    // Round-trips through the input helpers
    expect(dueTimeInputValue(iso)).toBe('15:30')
  })

  it('formats with a time only when one was set', () => {
    expect(formatDueDateTime('2026-09-06T00:00:00.000Z')).toBe('Sep 6')
    expect(formatDueDateTime(new Date(2026, 8, 6, 15, 30).toISOString())).toMatch(/^Sep 6, 3:30 PM/)
  })
})
