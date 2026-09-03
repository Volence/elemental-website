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

/** "HH:MM" (local) when the due date carries a time, else "" for date-only values. */
export function dueTimeInputValue(iso: string | null | undefined): string {
  if (!iso || isDateOnly(iso)) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Build the value to save from the modal's date and time inputs.
 * No time: keep the date-only "YYYY-MM-DD" convention (stored as UTC midnight).
 * With a time: a real local instant, so the calendar and Discord show it correctly.
 */
export function composeDueDate(dateKey: string, time: string): string | null {
  if (!dateKey) return null
  if (!time) return dateKey
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const local = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
  return Number.isNaN(local.getTime()) ? dateKey : local.toISOString()
}

/** "Sep 6" for date-only values, "Sep 6, 3:30 PM EDT" when a time was set. */
export function formatDueDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  if (isDateOnly(iso)) return formatDueDate(iso)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
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

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

/** Board ordering: soonest due date first, undated last, higher priority breaks ties. */
export function compareTasksByDueDate(
  a: { dueDate?: string | null; priority?: string | null },
  b: { dueDate?: string | null; priority?: string | null },
): number {
  const ka = dueDateKey(a.dueDate)
  const kb = dueDateKey(b.dueDate)
  if (ka && kb && ka !== kb) return ka < kb ? -1 : 1
  if (ka && !kb) return -1
  if (!ka && kb) return 1
  return (PRIORITY_RANK[a.priority || 'medium'] ?? 2) - (PRIORITY_RANK[b.priority || 'medium'] ?? 2)
}
