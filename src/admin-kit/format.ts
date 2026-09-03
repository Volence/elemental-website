/**
 * Admin formatters. One vocabulary for dates, numbers, records and names.
 *
 * Conventions (see docs/superpowers/specs/2026-09-03-admin-ui-kit-design.md 5.3):
 * - Any format that includes a time also includes the timezone abbreviation.
 * - Percentages are integers 0 to 100.
 * - Compact numbers use a lowercase k above 1000.
 * - W-L-D records are hyphen separated: 3-1-1.
 * - Missing values render as EMPTY ("-"), never as "N/A", dashes of other
 *   widths, "undefined" or "Person #12".
 */

export const EMPTY = '-'

const LOCALE = 'en-US'

type DateInput = string | number | Date | null | undefined

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Aug 30, 2026 */
export function formatDate(input: DateInput): string {
  const d = toDate(input)
  if (!d) return EMPTY
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

/** Aug 30 (no year; for dense tables where the year is obvious) */
export function formatDateShort(input: DateInput): string {
  const d = toDate(input)
  if (!d) return EMPTY
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' }).format(d)
}

/** 7:10 PM EDT */
export function formatTime(input: DateInput): string {
  const d = toDate(input)
  if (!d) return EMPTY
  return new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d)
}

/** Aug 30, 2026, 7:10 PM EDT */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input)
  if (!d) return EMPTY
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * just now / 5m ago / 3h ago / 2d ago, then the short date past 30 days.
 * Null renders as "not recorded": absence of a record is not the same as "never".
 */
export function formatRelative(input: DateInput, now: number = Date.now()): string {
  const d = toDate(input)
  if (!d) return 'not recorded'
  const diff = now - d.getTime()
  if (diff < 0) return formatDateShort(d)
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return formatDateShort(d)
}

/** 12,345 */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return EMPTY
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(n)
}

/**
 * Integer percent with the sign. Accepts a ratio (0 to 1) by default;
 * pass { of100: true } when the input is already 0 to 100.
 */
export function formatPercent(value: number | null | undefined, opts: { of100?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  const pct = opts.of100 ? value : value * 100
  return `${Math.round(pct)}%`
}

/** 950 -> 950, 1200 -> 1.2k, 15000 -> 15k, 1_500_000 -> 1.5m */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return EMPTY
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs < 1000) return `${sign}${Math.round(abs)}`
  if (abs < 10_000) return `${sign}${trimZero((abs / 1000).toFixed(1))}k`
  if (abs < 1_000_000) return `${sign}${Math.round(abs / 1000)}k`
  return `${sign}${trimZero((abs / 1_000_000).toFixed(1))}m`
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

/** 3-1-1 (draws always shown so columns line up). */
export function formatRecord(record: { w?: number | null; l?: number | null; d?: number | null }): string {
  const w = record.w ?? 0
  const l = record.l ?? 0
  const d = record.d ?? 0
  return `${w}-${l}-${d}`
}

type PersonLike =
  | number
  | string
  | { name?: string | null; email?: string | null; displayName?: string | null; username?: string | null }
  | null
  | undefined

/**
 * Display label for a person relationship in any populated state.
 * Never exposes a numeric id to the user.
 */
export function getPersonLabel(person: PersonLike): string {
  if (person === null || person === undefined) return 'Unnamed person'
  if (typeof person === 'number' || typeof person === 'string') return 'Unnamed person'
  const name = person.name ?? person.displayName ?? person.username
  if (name && name.trim()) return name.trim()
  if (person.email && !person.email.endsWith('@elmt.placeholder')) return person.email
  return 'Unnamed person'
}

/** Up to two initials for an avatar fallback: "Jane Doe" -> "JD", "malevolence" -> "M". */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** Discord CDN avatars default to 1024px; request the size we render. */
export function withAvatarSize(url: string | null | undefined, size: number): string | null {
  if (!url) return null
  if (!/cdn\.discordapp\.com/.test(url)) return url
  try {
    const u = new URL(url)
    u.searchParams.set('size', String(size))
    return u.toString()
  } catch {
    return url
  }
}
