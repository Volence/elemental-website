import { describe, it, expect } from 'vitest'
import { isRosterComplete } from '@/accessReview/discordRoster'

describe('isRosterComplete', () => {
  it('trusts the cache only when it holds every member', () => {
    expect(isRosterComplete(500, 500)).toBe(true)
    expect(isRosterComplete(512, 500)).toBe(true)
  })

  it('rejects a partial cache even when it is non-empty', () => {
    expect(isRosterComplete(120, 500)).toBe(false)
    expect(isRosterComplete(1, 500)).toBe(false)
  })

  it('rejects when the member count is unknown', () => {
    expect(isRosterComplete(500, null)).toBe(false)
    expect(isRosterComplete(500, undefined)).toBe(false)
    expect(isRosterComplete(500, 0)).toBe(false)
    expect(isRosterComplete(500, Number.NaN)).toBe(false)
  })
})
