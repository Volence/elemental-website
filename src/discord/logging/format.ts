/** "1st", "2nd", "2,210th" - ordinal with thousands separators. */
export function ordinal(n: number): string {
  const formatted = n.toLocaleString('en-US')
  const mod100 = n % 100
  const mod10 = n % 10
  let suffix = 'th'
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = 'st'
    else if (mod10 === 2) suffix = 'nd'
    else if (mod10 === 3) suffix = 'rd'
  }
  return `${formatted}${suffix}`
}

interface Breakdown {
  years: number
  months: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Calendar-aware breakdown of the gap between two instants into y/mo/d/h/m/s. */
function breakdown(fromMs: number, toMs: number): Breakdown {
  const from = new Date(Math.min(fromMs, toMs))
  const to = new Date(Math.max(fromMs, toMs))
  let years = to.getUTCFullYear() - from.getUTCFullYear()
  let months = to.getUTCMonth() - from.getUTCMonth()
  let days = to.getUTCDate() - from.getUTCDate()
  let hours = to.getUTCHours() - from.getUTCHours()
  let minutes = to.getUTCMinutes() - from.getUTCMinutes()
  let seconds = to.getUTCSeconds() - from.getUTCSeconds()
  if (seconds < 0) { seconds += 60; minutes -= 1 }
  if (minutes < 0) { minutes += 60; hours -= 1 }
  if (hours < 0) { hours += 24; days -= 1 }
  if (days < 0) {
    const daysInPrevMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate()
    days += daysInPrevMonth
    months -= 1
  }
  if (months < 0) { months += 12; years -= 1 }
  return { years, months, days, hours, minutes, seconds }
}

/**
 * Human-readable duration like "9 years, 9 months and 29 days" or "6 hours and 15 minutes".
 * Shows the largest `maxUnits` non-zero units, calendar-aware for years/months.
 */
export function humanizeDuration(fromMs: number, toMs: number, maxUnits = 3): string {
  const b = breakdown(fromMs, toMs)
  const order: Array<[number, string]> = [
    [b.years, 'year'],
    [b.months, 'month'],
    [b.days, 'day'],
    [b.hours, 'hour'],
    [b.minutes, 'minute'],
    [b.seconds, 'second'],
  ]
  const parts: string[] = []
  for (const [val, unit] of order) {
    if (val > 0) parts.push(`${val} ${unit}${val === 1 ? '' : 's'}`)
    if (parts.length >= maxUnits) break
  }
  if (parts.length === 0) return 'less than a second'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
