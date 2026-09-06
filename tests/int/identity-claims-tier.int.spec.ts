import { describe, it, expect } from 'vitest'
import { claimTier, canReviewClaim } from '@/identity/claims'

describe('claimTier', () => {
  it('is manager for a plain roster person', () => {
    expect(claimTier({ role: 'user', departments: { isPugAdmin: false } }, false)).toBe('manager')
  })
  it('is manager for an unrecognized/legacy role value (roleRank falls back to user)', () => {
    expect(claimTier({ role: 'player' }, false)).toBe('manager')
    expect(claimTier({ role: 'team-manager' }, false)).toBe('manager')
  })
  it('is admin when the target has any elevated role', () => {
    expect(claimTier({ role: 'staff-manager' }, false)).toBe('admin')
    expect(claimTier({ role: 'admin' }, false)).toBe('admin')
  })
  it('is admin when any department flag is on', () => {
    expect(claimTier({ role: 'user', departments: { isGraphicsStaff: true } }, false)).toBe('admin')
  })
  it('is admin when the target has a staff title', () => {
    expect(claimTier({ role: 'user' }, true)).toBe('admin')
  })
})

describe('canReviewClaim', () => {
  it('admin reviews anything', () => {
    expect(canReviewClaim({ reviewer: { id: 1, canManagePeople: true, isAdmin: true }, tier: 'admin', targetTeamManagerIds: [] })).toBe(true)
  })
  it('staff-manager reviews manager-tier only', () => {
    expect(canReviewClaim({ reviewer: { id: 1, canManagePeople: true, isAdmin: false }, tier: 'manager', targetTeamManagerIds: [] })).toBe(true)
    expect(canReviewClaim({ reviewer: { id: 1, canManagePeople: true, isAdmin: false }, tier: 'admin', targetTeamManagerIds: [] })).toBe(false)
  })
  it("a team's manager reviews manager-tier claims for their own team only", () => {
    expect(canReviewClaim({ reviewer: { id: 7, canManagePeople: false, isAdmin: false }, tier: 'manager', targetTeamManagerIds: [7, 9] })).toBe(true)
    expect(canReviewClaim({ reviewer: { id: 8, canManagePeople: false, isAdmin: false }, tier: 'manager', targetTeamManagerIds: [7, 9] })).toBe(false)
    expect(canReviewClaim({ reviewer: { id: 7, canManagePeople: false, isAdmin: false }, tier: 'admin', targetTeamManagerIds: [7] })).toBe(false)
  })
})
