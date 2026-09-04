import { describe, it, expect } from 'vitest'
import {
  weekBounds,
  nextWeekBounds,
  shouldReleaseNextWeek,
  shouldAnnounceCalendar,
  dateFromKey,
  toDateKey,
} from '@/utilities/weeklyCalendars'

describe('weekBounds', () => {
  it('returns the Monday to Sunday week containing the date', () => {
    // Friday 2026-09-04 (local)
    const { mondayStr, sundayStr } = weekBounds(new Date(2026, 8, 4, 15, 0))
    expect(mondayStr).toBe('2026-08-31')
    expect(sundayStr).toBe('2026-09-06')
  })

  it('treats Sunday as the end of the week, not the start', () => {
    const { mondayStr, sundayStr } = weekBounds(new Date(2026, 8, 6, 10, 0))
    expect(mondayStr).toBe('2026-08-31')
    expect(sundayStr).toBe('2026-09-06')
  })

  it('nextWeekBounds is the following Monday to Sunday', () => {
    const { monday } = weekBounds(new Date(2026, 8, 4))
    const next = nextWeekBounds(monday)
    expect(next.mondayStr).toBe('2026-09-07')
    expect(next.sundayStr).toBe('2026-09-13')
  })
})

describe('shouldReleaseNextWeek', () => {
  it('releases on the release day once the release time has passed, team-local', () => {
    expect(shouldReleaseNextWeek({ localDate: '2026-09-04', localTime: '09:00', releaseDay: 'friday' })).toBe(true)
    expect(shouldReleaseNextWeek({ localDate: '2026-09-04', localTime: '08:59', releaseDay: 'friday' })).toBe(false)
  })

  it('stays released for the rest of the week after the release day', () => {
    expect(shouldReleaseNextWeek({ localDate: '2026-09-05', localTime: '00:10', releaseDay: 'friday' })).toBe(true)
    expect(shouldReleaseNextWeek({ localDate: '2026-09-06', localTime: '23:00', releaseDay: 'friday' })).toBe(true)
  })

  it('is not released before the release day', () => {
    expect(shouldReleaseNextWeek({ localDate: '2026-09-03', localTime: '12:00', releaseDay: 'friday' })).toBe(false)
    // Monday release means the whole week is released
    expect(shouldReleaseNextWeek({ localDate: '2026-08-31', localTime: '09:30', releaseDay: 'monday' })).toBe(true)
  })

  it('defaults to Friday and 09:00 when the team has no setting', () => {
    expect(shouldReleaseNextWeek({ localDate: '2026-09-04', localTime: '09:00' })).toBe(true)
    expect(shouldReleaseNextWeek({ localDate: '2026-09-03', localTime: '23:59' })).toBe(false)
  })

  it('honours a custom release time', () => {
    expect(shouldReleaseNextWeek({ localDate: '2026-09-02', localTime: '18:00', releaseDay: 'wednesday', releaseTime: '18:00' })).toBe(true)
    expect(shouldReleaseNextWeek({ localDate: '2026-09-02', localTime: '17:59', releaseDay: 'wednesday', releaseTime: '18:00' })).toBe(false)
  })
})

describe('dateFromKey / toDateKey', () => {
  it('accepts a bare date key', () => {
    expect(dateFromKey('2026-09-07').getDate()).toBe(7)
    expect(toDateKey('2026-09-07')).toBe('2026-09-07')
  })
  it('accepts the ISO timestamps Payload returns for date fields', () => {
    expect(toDateKey('2026-09-07T00:00:00.000Z')).toBe('2026-09-07')
    const d = dateFromKey('2026-09-07T00:00:00.000Z')
    expect(Number.isNaN(d.getTime())).toBe(false)
    expect(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).toBe('Sep 7')
  })
})

describe('shouldAnnounceCalendar', () => {
  const team = { active: true, discordThreads: { availabilityThreadId: '123456789012345678' } }
  const calendar = { scheduleType: 'calendar', createdVia: 'auto', status: 'active', dateRange: { start: '2026-09-07', end: '2026-09-13' } }

  it('announces an auto-created calendar for a week that has not started', () => {
    expect(shouldAnnounceCalendar(calendar, team, '2026-09-04')).toBe(true)
  })

  it('handles timestamp date ranges the same as bare dates', () => {
    const iso = { ...calendar, dateRange: { start: '2026-09-07T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' } }
    expect(shouldAnnounceCalendar(iso, team, '2026-09-04')).toBe(true)
    expect(shouldAnnounceCalendar(iso, team, '2026-09-07')).toBe(false)
  })

  it('does not announce the current week (nobody wants a link for a week already underway)', () => {
    expect(shouldAnnounceCalendar(calendar, team, '2026-09-07')).toBe(false)
    expect(shouldAnnounceCalendar(calendar, team, '2026-09-09')).toBe(false)
  })

  it('skips teams without an availability thread or that are inactive', () => {
    expect(shouldAnnounceCalendar(calendar, { active: true, discordThreads: {} }, '2026-09-04')).toBe(false)
    expect(shouldAnnounceCalendar(calendar, { ...team, active: false }, '2026-09-04')).toBe(false)
  })

  it('skips polls that are not auto-created calendars', () => {
    expect(shouldAnnounceCalendar({ ...calendar, scheduleType: 'poll' }, team, '2026-09-04')).toBe(false)
    expect(shouldAnnounceCalendar({ ...calendar, createdVia: 'admin-panel' }, team, '2026-09-04')).toBe(false)
  })
})
