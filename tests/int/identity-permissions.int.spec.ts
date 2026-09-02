import { describe, it, expect } from 'vitest'
import { canPickMembers } from '@/identity/permissions'

describe('canPickMembers', () => {
  it('allows admin, staff-manager, team-manager', () => {
    expect(canPickMembers({ role: 'admin' })).toBe(true)
    expect(canPickMembers({ role: 'staff-manager' })).toBe(true)
    expect(canPickMembers({ role: 'team-manager' })).toBe(true)
  })
  it('allows any department flag', () => {
    expect(canPickMembers({ role: 'user', departments: { isPugAdmin: true } })).toBe(true)
  })
  it('denies plain users and anonymous', () => {
    expect(canPickMembers({ role: 'user', departments: { isPugAdmin: false } })).toBe(false)
    expect(canPickMembers(null)).toBe(false)
  })
})
