import { describe, it, expect } from 'vitest'
import { resolveMutation } from '@/accessReview/mutate'

const person = {
  id: 5,
  role: 'staff-manager',
  departments: { isGraphicsStaff: true, isEventsStaff: false },
  assignedTeams: [{ id: 10 }, 11],
}

describe('resolveMutation - role', () => {
  it('sets a valid role', () => {
    const result = resolveMutation({ person, body: { kind: 'role', value: 'user' }, actorId: 1, adminCount: 2 })
    expect(result).toEqual({ ok: true, data: { role: 'user' } })
  })

  it('rejects an unknown role', () => {
    const result = resolveMutation({ person, body: { kind: 'role', value: 'wizard' }, actorId: 1, adminCount: 2 })
    expect(result).toEqual({ ok: false, status: 400, error: 'Unknown role: wizard' })
  })

  it('refuses to let an actor change their own role', () => {
    const result = resolveMutation({ person, body: { kind: 'role', value: 'user' }, actorId: 5, adminCount: 2 })
    expect(result).toEqual({ ok: false, status: 403, error: 'You cannot change your own role' })
  })

  it('refuses to demote the last remaining admin', () => {
    const admin = { ...person, role: 'admin' }
    const result = resolveMutation({ person: admin, body: { kind: 'role', value: 'user' }, actorId: 1, adminCount: 1 })
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Refusing to remove the last remaining Admin',
    })
  })

  it('allows demoting an admin while others remain', () => {
    const admin = { ...person, role: 'admin' }
    const result = resolveMutation({ person: admin, body: { kind: 'role', value: 'user' }, actorId: 1, adminCount: 3 })
    expect(result).toEqual({ ok: true, data: { role: 'user' } })
  })
})

describe('resolveMutation - department', () => {
  it('clears one flag and preserves the rest', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'department', key: 'isGraphicsStaff', value: false },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({
      ok: true,
      data: { departments: { isGraphicsStaff: false, isEventsStaff: false } },
    })
  })

  it('rejects an unknown department key', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'department', key: 'isWizard', value: true },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({ ok: false, status: 400, error: 'Unknown department: isWizard' })
  })
})

describe('resolveMutation - team', () => {
  it('removes one team and keeps the others', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'team', teamId: 10, value: false },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({ ok: true, data: { assignedTeams: [11] } })
  })

  it('adds a team without duplicating an existing one', () => {
    expect(
      resolveMutation({ person, body: { kind: 'team', teamId: 12, value: true }, actorId: 1, adminCount: 2 }),
    ).toEqual({ ok: true, data: { assignedTeams: [10, 11, 12] } })
    expect(
      resolveMutation({ person, body: { kind: 'team', teamId: 11, value: true }, actorId: 1, adminCount: 2 }),
    ).toEqual({ ok: true, data: { assignedTeams: [10, 11] } })
  })

  it('rejects a non-numeric team id', () => {
    const result = resolveMutation({
      person,
      body: { kind: 'team', teamId: 'ten', value: true },
      actorId: 1,
      adminCount: 2,
    })
    expect(result).toEqual({ ok: false, status: 400, error: 'teamId must be a number' })
  })
})

describe('resolveMutation - bad input', () => {
  it('rejects an unknown kind', () => {
    const result = resolveMutation({ person, body: { kind: 'nickname' }, actorId: 1, adminCount: 2 })
    expect(result).toEqual({ ok: false, status: 400, error: 'Unknown mutation kind: nickname' })
  })
})
