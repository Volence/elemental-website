import { describe, it, expect } from 'vitest'
import { filterEvents, eventEndsAt, type CalendarEventRow } from '@/components/CalendarEventsList/filters'

const NOW = new Date('2026-09-03T12:00:00Z').getTime()
const e = (over: Partial<CalendarEventRow> & { id: number; title: string; dateStart: string }): CalendarEventRow => over
const EVENTS: CalendarEventRow[] = [
  e({ id: 1, title: 'FACEIT S7 Playoffs', eventType: 'faceit', region: 'NA', dateStart: '2026-09-10T18:00:00Z' }),
  e({ id: 2, title: 'Community night', eventType: 'community', region: 'EMEA', dateStart: '2026-09-01T18:00:00Z', dateEnd: '2026-09-04T00:00:00Z' }),
  e({ id: 3, title: 'Seminar', eventType: 'internal', internalEventType: 'seminar', region: 'global', dateStart: '2026-08-20T18:00:00Z' }),
  e({ id: 4, title: 'OWCS Open', eventType: 'owcs', region: 'NA', dateStart: '2026-09-20T18:00:00Z' }),
]
const base = { search: '', type: 'all', when: 'all' as const, region: 'all' }

describe('filterEvents', () => {
  it('treats a running multi-day event as upcoming until it ends', () => {
    expect(eventEndsAt(EVENTS[1])).toBeGreaterThan(NOW)
    expect(filterEvents(EVENTS, { ...base, when: 'upcoming' }, NOW).map((x) => x.id)).toEqual([2, 1, 4])
    expect(filterEvents(EVENTS, { ...base, when: 'past' }, NOW).map((x) => x.id)).toEqual([3])
  })
  it('filters by type, region and title', () => {
    expect(filterEvents(EVENTS, { ...base, type: 'faceit' }, NOW).map((x) => x.id)).toEqual([1])
    expect(filterEvents(EVENTS, { ...base, region: 'NA' }, NOW).map((x) => x.id)).toEqual([1, 4])
    expect(filterEvents(EVENTS, { ...base, search: 'open' }, NOW).map((x) => x.id)).toEqual([4])
  })
  it('orders upcoming soonest first and past most recent first', () => {
    const past = filterEvents([...EVENTS, e({ id: 5, title: 'Older', dateStart: '2026-07-01T00:00:00Z' })], { ...base, when: 'past' }, NOW)
    expect(past.map((x) => x.id)).toEqual([3, 5])
  })
})
