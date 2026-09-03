/**
 * Pure date helpers for the Organization Calendar. No React, no fetch.
 * All arithmetic is in the browser's local timezone, matching what the grid renders.
 */
import type { Department } from './types'

export type CalendarViewMode = 'week' | 'month'

export interface ViewRange {
  /** First instant rendered (local midnight). */
  start: Date
  /** Last instant rendered (local 23:59:59.999). */
  end: Date
  /** Every day cell the view draws, in order. Month view is always six full weeks. */
  days: Date[]
}

export function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function endOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}

/** Sunday-start week containing `date`. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date)
  start.setDate(start.getDate() - start.getDay())
  return start
}

/**
 * The exact range the grid renders, so data is fetched for every visible cell.
 * The old implementation fetched the 1st to the last of the month but drew six
 * weeks, so the leading and trailing days were always empty.
 */
export function getViewRange(date: Date, mode: CalendarViewMode): ViewRange {
  const days: Date[] = []
  if (mode === 'week') {
    const start = startOfWeek(date)
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
  } else {
    const first = new Date(date.getFullYear(), date.getMonth(), 1)
    const gridStart = startOfWeek(first)
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      days.push(d)
    }
  }
  return { start: startOfDay(days[0]), end: endOfDay(days[days.length - 1]), days }
}

export function shiftPeriod(date: Date, mode: CalendarViewMode, direction: -1 | 1): Date {
  if (mode === 'week') {
    const next = new Date(date)
    next.setDate(date.getDate() + 7 * direction)
    return next
  }
  return new Date(date.getFullYear(), date.getMonth() + direction, 1)
}

/** YYYY-MM-DD in local time, for the ?date= param. */
export function formatDateParam(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse ?date=YYYY-MM-DD as a local date. Anything else falls back to `fallback`. */
export function parseDateParam(raw: string | null | undefined, fallback: Date = new Date()): Date {
  if (!raw) return fallback
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) return fallback
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? fallback : d
}

export function parseViewMode(raw: string | null | undefined): CalendarViewMode {
  return raw === 'month' ? 'month' : 'week'
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Label for the period header. */
export function formatPeriodLabel(range: ViewRange, mode: CalendarViewMode, anchor: Date): string {
  if (mode === 'month') {
    return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const start = range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} - ${end}`
}

/**
 * Where a task on the calendar should open. Department boards accept ?task= and
 * open the task modal. Departments without a board fall back to the raw record.
 */
export function taskHref(department: Department | string | null | undefined, taskId: string | number): string {
  const boards: Record<string, string> = {
    graphics: '/admin/collections/graphics-anchor',
    video: '/admin/collections/video-anchor',
    events: '/admin/collections/events-anchor',
    'social-media': '/admin/globals/social-media-settings',
  }
  const base = department ? boards[department] : undefined
  if (!base) return `/admin/collections/tasks/${taskId}`
  return `${base}?task=${taskId}`
}
