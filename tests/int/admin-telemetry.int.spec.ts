import { describe, it, expect } from 'vitest'
import {
  normalizeAdminPath,
  shouldTouchActivity,
  parseSummaryWindow,
  ACTIVITY_TOUCH_THROTTLE_MS,
} from '@/utilities/adminTelemetry'

describe('normalizeAdminPath', () => {
  it('keeps plain admin paths', () => {
    expect(normalizeAdminPath('/admin')).toBe('/admin')
    expect(normalizeAdminPath('/admin/calendar')).toBe('/admin/calendar')
    expect(normalizeAdminPath('/admin/pug-dashboard')).toBe('/admin/pug-dashboard')
  })

  it('drops query strings and hashes, which can carry ids and tokens', () => {
    expect(normalizeAdminPath('/admin/edit-person?id=42')).toBe('/admin/edit-person')
    expect(normalizeAdminPath('/admin/scrim-team?teamId=7&range=last20#roster')).toBe('/admin/scrim-team')
  })

  it('collapses numeric path segments so records group per screen', () => {
    expect(normalizeAdminPath('/admin/collections/teams/42')).toBe('/admin/collections/teams/:id')
    expect(normalizeAdminPath('/admin/collections/teams/43/')).toBe('/admin/collections/teams/:id')
  })

  it('ignores anything outside /admin, non-strings, and absurd lengths', () => {
    expect(normalizeAdminPath('/api/people')).toBeNull()
    expect(normalizeAdminPath('/teams')).toBeNull()
    expect(normalizeAdminPath(undefined)).toBeNull()
    expect(normalizeAdminPath(42)).toBeNull()
    expect(normalizeAdminPath('/admin/' + 'x'.repeat(300))).toBeNull()
  })
})

describe('shouldTouchActivity', () => {
  it('touches on first sight', () => {
    expect(shouldTouchActivity(undefined, 1_000_000)).toBe(true)
  })

  it('throttles within the window and allows after it', () => {
    const t0 = 1_000_000
    expect(shouldTouchActivity(t0, t0 + 1000)).toBe(false)
    expect(shouldTouchActivity(t0, t0 + ACTIVITY_TOUCH_THROTTLE_MS - 1)).toBe(false)
    expect(shouldTouchActivity(t0, t0 + ACTIVITY_TOUCH_THROTTLE_MS)).toBe(true)
  })
})

describe('parseSummaryWindow', () => {
  it('accepts the supported windows and defaults to 30 otherwise', () => {
    expect(parseSummaryWindow('7')).toBe(7)
    expect(parseSummaryWindow('30')).toBe(30)
    expect(parseSummaryWindow('90')).toBe(90)
    expect(parseSummaryWindow('365')).toBe(30)
    expect(parseSummaryWindow(null)).toBe(30)
    expect(parseSummaryWindow('abc')).toBe(30)
  })
})
