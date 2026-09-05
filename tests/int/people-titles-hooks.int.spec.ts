import { describe, it, expect } from 'vitest'
import { raiseRoleForTitles, enforcePersonAccessChange } from '@/collections/People/hooks/titlesAndRole'

describe('raiseRoleForTitles', () => {
  it('raises user to admin when an Owner title is present', () => {
    const data: any = { role: 'user', titles: [{ title: 'owner' }] }
    raiseRoleForTitles(data, { role: 'user' })
    expect(data.role).toBe('admin')
  })
  it('raises to staff-manager for HR and never lowers', () => {
    const d1: any = { titles: [{ title: 'hr' }] }
    raiseRoleForTitles(d1, { role: 'user' })
    expect(d1.role).toBe('staff-manager')
    const d2: any = { role: 'admin', titles: [{ title: 'hr' }] }
    raiseRoleForTitles(d2, { role: 'admin' })
    expect(d2.role).toBe('admin')
    const d3: any = { titles: [] }
    raiseRoleForTitles(d3, { role: 'admin' })
    expect(d3.role).toBeUndefined()
  })
  it('does nothing without role-implying titles', () => {
    const d: any = { role: 'user', titles: [{ title: 'caster' }] }
    raiseRoleForTitles(d, { role: 'user' })
    expect(d.role).toBe('user')
  })
})

describe('enforcePersonAccessChange', () => {
  const payload = { find: async () => ({ docs: [] }) }
  const reqFor = (user: any) => ({ user, payload, context: {} }) as any
  const original = { id: 50, role: 'user', titles: [{ title: 'caster' }], departments: {}, teamAccess: [] }

  it('lets an admin change anything', async () => {
    await expect(enforcePersonAccessChange({ req: reqFor({ id: 1, role: 'admin' }), data: { role: 'admin', titles: [] }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
  it('lets a social lead grant social', async () => {
    const req = reqFor({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] })
    await expect(enforcePersonAccessChange({ req, data: { titles: [{ title: 'caster' }, { title: 'social-manager' }] }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
  it('rejects a social lead granting graphics with a 403 APIError', async () => {
    const req = reqFor({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] })
    await expect(enforcePersonAccessChange({ req, data: { titles: [{ title: 'caster' }, { title: 'graphics' }] }, originalDoc: original, operation: 'update' })).rejects.toMatchObject({ status: 403 })
  })
  it('ignores updates that do not touch access fields', async () => {
    const req = reqFor({ id: 50, role: 'user' })
    await expect(enforcePersonAccessChange({ req, data: { bio: 'hi' }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
  it('skips when there is no user (internal/local API with overrideAccess)', async () => {
    await expect(enforcePersonAccessChange({ req: reqFor(null), data: { role: 'admin' }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
  })
})
