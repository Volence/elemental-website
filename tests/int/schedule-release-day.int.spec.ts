import { describe, it, expect } from 'vitest'
import { isNextWeekReleased } from '@/utilities/scheduleReleaseDay'

// Dates in June 2026: Mon 15th, Tue 16th, Wed 17th, Thu 18th, Fri 19th, Sat 20th, Sun 21st
const MON = new Date('2026-06-15T12:00:00')
const TUE = new Date('2026-06-16T12:00:00')
const WED = new Date('2026-06-17T12:00:00')
const THU = new Date('2026-06-18T12:00:00')
const FRI = new Date('2026-06-19T12:00:00')
const SAT = new Date('2026-06-20T12:00:00')
const SUN = new Date('2026-06-21T12:00:00')

describe('isNextWeekReleased', () => {
  it('defaults to Friday when no release day is configured', () => {
    expect(isNextWeekReleased(THU, undefined)).toBe(false)
    expect(isNextWeekReleased(FRI, undefined)).toBe(true)
    expect(isNextWeekReleased(SAT, null)).toBe(true)
    expect(isNextWeekReleased(SUN, undefined)).toBe(true)
    expect(isNextWeekReleased(MON, undefined)).toBe(false)
  })

  it('releases on the configured day', () => {
    expect(isNextWeekReleased(TUE, 'wednesday')).toBe(false)
    expect(isNextWeekReleased(WED, 'wednesday')).toBe(true)
  })

  it('still releases after the configured day was missed', () => {
    // Nobody visited on Wednesday - Thursday through Sunday must still release
    expect(isNextWeekReleased(THU, 'wednesday')).toBe(true)
    expect(isNextWeekReleased(FRI, 'wednesday')).toBe(true)
    expect(isNextWeekReleased(SUN, 'wednesday')).toBe(true)
    // But the following Monday starts a fresh week
    expect(isNextWeekReleased(MON, 'wednesday')).toBe(false)
  })

  it('supports Monday (always released - a full week ahead)', () => {
    for (const day of [MON, TUE, WED, THU, FRI, SAT, SUN]) {
      expect(isNextWeekReleased(day, 'monday')).toBe(true)
    }
  })

  it('supports Sunday (release day is the last day of the week)', () => {
    expect(isNextWeekReleased(SAT, 'sunday')).toBe(false)
    expect(isNextWeekReleased(SUN, 'sunday')).toBe(true)
  })

  it('falls back to Friday on an unknown value', () => {
    expect(isNextWeekReleased(THU, 'someday')).toBe(false)
    expect(isNextWeekReleased(FRI, 'someday')).toBe(true)
  })
})
