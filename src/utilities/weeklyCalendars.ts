import type { Payload } from 'payload'
import { DEFAULT_RELEASE_DAY } from './scheduleReleaseDay'

/**
 * Weekly availability calendars (discord-polls with scheduleType 'calendar').
 *
 * The week runs Monday to Sunday. The current week's calendar always exists
 * for an active team; next week's is created once the team's release day and
 * time have passed in the team's timezone. Both the public schedule page and
 * the in-process release service call `maintainTeamCalendars`, so creation
 * happens on the release day whether or not anyone visits the site.
 */

export interface WeekBounds {
  monday: Date
  sunday: Date
  mondayStr: string
  sundayStr: string
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday to Sunday week containing `now` (local calendar date). */
export function weekBounds(now: Date): WeekBounds {
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday, mondayStr: dateKey(monday), sundayStr: dateKey(sunday) }
}

export function nextWeekBounds(monday: Date): WeekBounds {
  const next = new Date(monday)
  next.setDate(monday.getDate() + 7)
  return weekBounds(next)
}

/**
 * YYYY-MM-DD from a date key or a full ISO timestamp. Payload returns date
 * fields as timestamps, so anything reading `dateRange` goes through here.
 */
export function toDateKey(value: string | Date): string {
  if (value instanceof Date) return dateKey(value)
  return String(value).slice(0, 10)
}

/** A date at noon on the given YYYY-MM-DD (or ISO timestamp), safe from DST edge cases. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = toDateKey(key).split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

// Monday-based index (Mon=0 .. Sun=6), matching the Mon-Sun schedule week
const RELEASE_DAY_INDEX: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
}

export const DEFAULT_RELEASE_TIME = '09:00'

export interface ReleaseDecision {
  /** YYYY-MM-DD in the team's timezone */
  localDate: string
  /** HH:mm (24h) in the team's timezone */
  localTime: string
  releaseDay?: string | null
  /** HH:mm; defaults to 09:00 so the link lands in the morning, not at midnight */
  releaseTime?: string | null
}

/**
 * Whether next week's calendar should exist right now. True from the release
 * day and time through the end of the week, so a missed release still
 * happens later that week.
 */
export function shouldReleaseNextWeek({ localDate, localTime, releaseDay, releaseTime }: ReleaseDecision): boolean {
  const releaseIdx = RELEASE_DAY_INDEX[releaseDay ?? ''] ?? RELEASE_DAY_INDEX[DEFAULT_RELEASE_DAY]
  const todayIdx = (dateFromKey(localDate).getDay() + 6) % 7
  if (todayIdx > releaseIdx) return true
  if (todayIdx < releaseIdx) return false
  const target = releaseTime && /^\d{2}:\d{2}$/.test(releaseTime) ? releaseTime : DEFAULT_RELEASE_TIME
  return localTime >= target
}

export interface CalendarLike {
  scheduleType?: string | null
  createdVia?: string | null
  status?: string | null
  dateRange?: { start?: string | null; end?: string | null } | null
}

export interface TeamLike {
  active?: boolean | null
  discordThreads?: { availabilityThreadId?: string | null } | null
}

/**
 * Post the availability link for a freshly auto-created calendar only when it
 * is for a week that has not started yet and the team has a thread for it.
 */
export function shouldAnnounceCalendar(calendar: CalendarLike, team: TeamLike, localToday: string): boolean {
  if (calendar.scheduleType !== 'calendar') return false
  if (calendar.createdVia !== 'auto') return false
  if (calendar.status && calendar.status !== 'active') return false
  if (!team.active) return false
  if (!team.discordThreads?.availabilityThreadId) return false
  const start = calendar.dateRange?.start
  if (!start) return false
  return toDateKey(start) > toDateKey(localToday)
}

export interface MaintainOptions {
  /** Reference date for the current week (local calendar date). */
  now: Date
  /** Whether next week's calendar should exist. */
  releaseNextWeek: boolean
  /** False for anonymous page views: read only, never create or mutate. */
  canWrite: boolean
}

export interface MaintainResult {
  current: any | null
  next: any | null
  created: any[]
  bounds: WeekBounds
}

/**
 * Close expired calendars, make sure this week's exists, and next week's when
 * released. Returns the calendars plus the ones created by this call.
 */
export async function maintainTeamCalendars(payload: Payload, team: any, opts: MaintainOptions): Promise<MaintainResult> {
  const created: any[] = []
  const bounds = weekBounds(opts.now)

  if (opts.canWrite) {
    const expired = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
          { status: { equals: 'active' } },
          { 'dateRange.end': { less_than: bounds.mondayStr } },
        ],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const cal of expired.docs) {
      await payload.update({
        collection: 'discord-polls' as any,
        id: cal.id,
        data: { status: 'closed' },
        overrideAccess: true,
      })
    }
  }

  async function ensureCalendar(week: WeekBounds): Promise<any | null> {
    const existing = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
          { status: { equals: 'active' } },
          { 'dateRange.start': { less_than_equal: week.sundayStr } },
          { 'dateRange.end': { greater_than_equal: week.mondayStr } },
        ],
      },
      limit: 1,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })

    const teamBlocks: any[] = team.scheduleBlocks || []
    const slotsFromTeam = () =>
      teamBlocks.map((b: any) => ({
        id: `auto_${b.startTime}_${Date.now()}`,
        label: b.label,
        startTime: b.startTime,
        endTime: b.endTime,
      }))

    if (existing.docs.length > 0) {
      const cal = existing.docs[0] as any
      if (!opts.canWrite || teamBlocks.length === 0) return cal
      // Keep the calendar's slots in step with the team's configured blocks
      const currentKeys = (cal.timeSlots || []).map((s: any) => `${s.startTime}|${s.label}`).sort().join(',')
      const teamKeys = teamBlocks.map((b: any) => `${b.startTime}|${b.label}`).sort().join(',')
      if (currentKeys !== teamKeys) {
        const syncedSlots = slotsFromTeam()
        await payload.update({
          collection: 'discord-polls' as any,
          id: cal.id,
          data: { timeSlots: syncedSlots },
          overrideAccess: true,
        })
        return { ...cal, timeSlots: syncedSlots }
      }
      return cal
    }

    if (!opts.canWrite) return null

    const monthDay = week.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const timeSlots = slotsFromTeam()
    try {
      const cal = await payload.create({
        collection: 'discord-polls' as any,
        data: {
          pollName: `Week of ${monthDay}`,
          team: team.id,
          scheduleType: 'calendar',
          status: 'active',
          dateRange: { start: week.mondayStr, end: week.sundayStr },
          timeSlots: timeSlots.length > 0 ? timeSlots : undefined,
          timezone: team.scheduleTimezone || 'America/New_York',
          createdVia: 'auto',
          responses: [],
          responseCount: 0,
        },
        overrideAccess: true,
      })
      created.push(cal)
      return cal
    } catch (err) {
      console.error('[WeeklyCalendars] Auto-create calendar error:', err)
      return null
    }
  }

  const current = await ensureCalendar(bounds)
  const next = opts.releaseNextWeek ? await ensureCalendar(nextWeekBounds(bounds.monday)) : null
  return { current, next, created, bounds }
}
