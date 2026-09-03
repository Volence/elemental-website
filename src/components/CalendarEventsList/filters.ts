/** Pure filter logic for the Calendar Events list, unit-tested. */

export interface CalendarEventRow {
  id: number
  title: string
  eventType?: 'faceit' | 'owcs' | 'community' | 'internal' | string | null
  internalEventType?: string | null
  region?: string | null
  dateStart: string
  dateEnd?: string | null
  publishToDiscord?: boolean | null
  updatedAt?: string
}

export type EventWhen = 'upcoming' | 'past' | 'all'

export interface EventFilters {
  search: string
  /** 'all' or an eventType value. */
  type: string
  when: EventWhen
  /** 'all' or a region value. */
  region: string
}

/** An event is upcoming until its end (or start, when it has no end) has passed. */
export function eventEndsAt(e: Pick<CalendarEventRow, 'dateStart' | 'dateEnd'>): number {
  return new Date(e.dateEnd || e.dateStart).getTime()
}

export function filterEvents(events: CalendarEventRow[], f: EventFilters, now: number = Date.now()): CalendarEventRow[] {
  const needle = f.search.trim().toLowerCase()
  const kept = events.filter((e) => {
    if (f.type !== 'all' && e.eventType !== f.type) return false
    if (f.region !== 'all' && e.region !== f.region) return false
    if (f.when === 'upcoming' && eventEndsAt(e) < now) return false
    if (f.when === 'past' && eventEndsAt(e) >= now) return false
    if (needle && !e.title.toLowerCase().includes(needle)) return false
    return true
  })
  // Upcoming reads soonest first; past reads most recent first.
  return kept.sort((a, b) => (f.when === 'past' ? (a.dateStart < b.dateStart ? 1 : -1) : a.dateStart < b.dateStart ? -1 : 1))
}
