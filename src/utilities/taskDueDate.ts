/**
 * Due-date helpers for workboard tasks.
 *
 * The workboard modal saves date-only due dates ("2026-09-06"), which Payload
 * stores as UTC midnight. Rendering that through `new Date()` in a US timezone
 * shows the previous day. These helpers treat a UTC-midnight timestamp as a
 * calendar date (no timezone shift) and only fall back to local time when the
 * value carries a real time of day.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DD" for a Date in the viewer's local timezone. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** True when the ISO timestamp is exactly midnight UTC (a date-only value). */
export function isDateOnly(iso: string): boolean {
  return /T00:00:00(?:\.000)?Z$/.test(iso) || /^\d{4}-\d{2}-\d{2}$/.test(iso)
}

/** "YYYY-MM-DD" calendar key for a task due date, or null when unset. */
export function dueDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  if (isDateOnly(iso)) return iso.slice(0, 10)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return localDateKey(d)
}

/** Value for an <input type="date"> that matches what the card displays. */
export function dueDateInputValue(iso: string | null | undefined): string {
  return dueDateKey(iso) ?? ''
}

/** A local Date at noon on the due date's calendar day (safe for formatting). */
export function dueDateAsLocalDate(iso: string | null | undefined): Date | null {
  const key = dueDateKey(iso)
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Format a due date for display without timezone drift. */
export function formatDueDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  const d = dueDateAsLocalDate(iso)
  return d ? d.toLocaleDateString('en-US', options) : ''
}

/** Return a new Date `days` after `date` (local time, no mutation). */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Sunday 00:00 to Saturday 23:59:59.999 (local) for the week containing `date`. */
export function weekBoundsFor(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  start.setHours(0, 0, 0, 0)
  const end = addDays(start, 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** First day of month 00:00 to last day 23:59:59.999 (local). */
export function monthBoundsFor(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}
