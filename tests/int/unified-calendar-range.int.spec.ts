import { describe, it, expect } from 'vitest'
import {
  getViewRange,
  shiftPeriod,
  formatDateParam,
  parseDateParam,
  parseViewMode,
  taskHref,
  formatPeriodLabel,
} from '@/components/UnifiedCalendar/range'

// 2026-09-02 is a Wednesday.
const WED = new Date(2026, 8, 2, 15, 30)

describe('getViewRange', () => {
  it('week view is Sunday to Saturday around the anchor', () => {
    const r = getViewRange(WED, 'week')
    expect(r.days).toHaveLength(7)
    expect(formatDateParam(r.start)).toBe('2026-08-30')
    expect(formatDateParam(r.end)).toBe('2026-09-05')
    expect(r.start.getHours()).toBe(0)
    expect(r.end.getHours()).toBe(23)
  })

  it('month view covers the full six-week grid, not just the 1st to the last', () => {
    const r = getViewRange(WED, 'month')
    expect(r.days).toHaveLength(42)
    // September 2026 starts on a Tuesday, so the grid begins Sunday Aug 30.
    expect(formatDateParam(r.start)).toBe('2026-08-30')
    expect(formatDateParam(r.end)).toBe('2026-10-10')
  })
})

describe('shiftPeriod', () => {
  it('moves a week or a month', () => {
    expect(formatDateParam(shiftPeriod(WED, 'week', 1))).toBe('2026-09-09')
    expect(formatDateParam(shiftPeriod(WED, 'week', -1))).toBe('2026-08-26')
    expect(formatDateParam(shiftPeriod(WED, 'month', 1))).toBe('2026-10-01')
    expect(formatDateParam(shiftPeriod(new Date(2026, 0, 31), 'month', 1))).toBe('2026-02-01')
  })
})

describe('url params', () => {
  it('round-trips dates and rejects garbage', () => {
    const fallback = new Date(2026, 0, 1)
    expect(formatDateParam(parseDateParam('2026-09-02', fallback))).toBe('2026-09-02')
    expect(parseDateParam('nope', fallback)).toBe(fallback)
    expect(parseDateParam(null, fallback)).toBe(fallback)
    expect(parseDateParam('2026-13-45', fallback)).not.toBe(fallback) // JS rolls over; still a valid date
  })
  it('parses the view mode with week as the default', () => {
    expect(parseViewMode('month')).toBe('month')
    expect(parseViewMode('week')).toBe('week')
    expect(parseViewMode(null)).toBe('week')
    expect(parseViewMode('bogus')).toBe('week')
  })
})

describe('taskHref', () => {
  it('opens the department board with ?task= when a board exists', () => {
    expect(taskHref('graphics', 12)).toBe('/admin/collections/graphics-anchor?task=12')
    // Tabbed dashboards open on the workboard tab, then the task.
    expect(taskHref('social-media', '7')).toBe('/admin/globals/social-media-settings?tab=workboard&task=7')
    expect(taskHref('production', 3)).toBe('/admin/globals/production-dashboard?tab=workboard&task=3')
  })
  it('falls back to the raw task record for departments without a board', () => {
    expect(taskHref(undefined, 3)).toBe('/admin/collections/tasks/3')
  })
})

describe('formatPeriodLabel', () => {
  it('shows a range for weeks and month-year for months', () => {
    expect(formatPeriodLabel(getViewRange(WED, 'week'), 'week', WED)).toBe('Aug 30 - Sep 5, 2026')
    expect(formatPeriodLabel(getViewRange(WED, 'month'), 'month', WED)).toBe('September 2026')
  })
})
