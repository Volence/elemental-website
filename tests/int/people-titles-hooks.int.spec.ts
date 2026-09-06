import { describe, it, expect, beforeEach } from 'vitest'
import { raiseRoleForTitles, enforcePersonAccessChange, authenticatedRead } from '@/collections/People/hooks/titlesAndRole'
import { invalidateTeamsCache } from '@/access/teamsCache'

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

  // A team manager: no titles/departments of their own, but manages a team (grants create
  // access and picker access, not canManagePeople or any department lead).
  const teamManagerPayload = { find: async () => ({ docs: [{ id: 9, manager: [{ person: 3 }], coaches: [], captain: [] }] }) }
  const reqForTeamManager = (user: any) => ({ user, payload: teamManagerPayload, context: {} }) as any

  beforeEach(() => {
    invalidateTeamsCache()
  })

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

  it('rejects a team manager granting Owner on create with a 403 APIError', async () => {
    const req = reqForTeamManager({ id: 3, role: 'user' })
    await expect(enforcePersonAccessChange({
      req,
      data: { name: 'X', discordId: '111111111111111111', titles: [{ title: 'owner' }] },
      originalDoc: undefined,
      operation: 'create',
    })).rejects.toMatchObject({ status: 403 })
  })

  it('lets a team manager create a person with no access fields', async () => {
    const req = reqForTeamManager({ id: 3, role: 'user' })
    await expect(enforcePersonAccessChange({
      req,
      data: { name: 'X', discordId: '111111111111111111' },
      originalDoc: undefined,
      operation: 'create',
    })).resolves.toBeUndefined()
  })

  it('lets an admin create a person with an Owner title', async () => {
    const req = reqFor({ id: 1, role: 'admin' })
    await expect(enforcePersonAccessChange({
      req,
      data: { name: 'X', discordId: '111111111111111111', titles: [{ title: 'owner' }] },
      originalDoc: undefined,
      operation: 'create',
    })).resolves.toBeUndefined()
  })

  // C1: a non-staff actor editing somebody else is limited to an allow-list over the whole
  // document, not just the four access fields.
  describe('whole-document allow-list for non-staff actors', () => {
    const leadReq = () => reqFor({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] })
    const pugReq = () => reqFor({ id: 4, role: 'user', departments: { isPugAdmin: true } })
    const patch = (req: any, data: any) =>
      enforcePersonAccessChange({ req, data, originalDoc: original, operation: 'update' })

    it('rejects a lead setting another person password, email or mergedInto', async () => {
      await expect(patch(leadReq(), { password: 'hunter2' })).rejects.toMatchObject({ status: 403 })
      await expect(patch(leadReq(), { email: 'x@example.com' })).rejects.toMatchObject({ status: 403 })
      await expect(patch(leadReq(), { mergedInto: 99 })).rejects.toMatchObject({ status: 403 })
    })

    it('lets a lead send titles alone', async () => {
      await expect(patch(leadReq(), { titles: [{ title: 'caster' }, { title: 'social-manager' }] })).resolves.toBeUndefined()
    })

    it('lets a PUG admin set PUG fields but not a password', async () => {
      await expect(patch(pugReq(), { pugTiers: ['invite'], pugApprovedRoles: ['tank'] })).resolves.toBeUndefined()
      await expect(patch(pugReq(), { password: 'hunter2' })).rejects.toMatchObject({ status: 403 })
    })

    // People's beforeValidate gets the merged document, not just the changed keys, so the
    // check has to be a diff: unchanged fields must not trip it.
    it('ignores the untouched fields of a merged document and catches only the changed one', async () => {
      const stored = { ...original, name: 'Kaz', email: null, bio: null, salt: 's', hash: 'h', avatar: 3, gameAliases: [{ alias: 'kaz' }] }
      const send = (data: any) => enforcePersonAccessChange({ req: leadReq(), data, originalDoc: stored, operation: 'update' })
      await expect(send({ ...stored, titles: [{ title: 'caster' }, { title: 'social-manager' }] })).resolves.toBeUndefined()
      await expect(send({ ...stored, email: 'new@example.com' })).rejects.toMatchObject({ status: 403 })
    })

    it('leaves self-edits alone: a plain user may change their own bio and password', async () => {
      const req = reqFor({ id: 50, role: 'user' })
      await expect(enforcePersonAccessChange({ req, data: { bio: 'hi', password: 'hunter2' }, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
    })

    it('limits a non-picker create to name and discordId, and lets the picker seed identity fields', async () => {
      const req = reqForTeamManager({ id: 3, role: 'user' })
      await expect(enforcePersonAccessChange({
        req,
        data: { name: 'X', discordId: '111111111111111111', email: 'x@example.com' },
        originalDoc: undefined,
        operation: 'create',
      })).rejects.toMatchObject({ status: 403 })

      const pickerReq = { ...reqForTeamManager({ id: 3, role: 'user' }), context: { identityCreate: true } } as any
      await expect(enforcePersonAccessChange({
        req: pickerReq,
        data: { name: 'X', discordId: '111111111111111111', username: '111111111111111111', password: 'random', discordUsername: 'x', discordAvatar: null },
        originalDoc: undefined,
        operation: 'create',
      })).resolves.toBeUndefined()
    })
  })

  // C3: Payload's field-level beforeValidate pass injects field defaults and empty groups into
  // the merged create doc before the collection hook runs - a team manager POSTing
  // { name, discordId } through the stock admin form actually reaches the hook looking like this.
  // None of that is a change the caller made, so it must not be treated as one.
  describe('non-staff create ignores Payload-injected defaults', () => {
    const defaultDepartments = {
      isProductionStaff: false, isSocialMediaStaff: false, isGraphicsStaff: false, isVideoStaff: false,
      isEventsStaff: false, isScoutingStaff: false, isContentCreator: false, isPugAdmin: false,
      canUploadExternalScrims: false,
    }
    const mergedCreateDoc = () => ({
      name: 'X',
      discordId: '111111111111111111',
      username: '111111111111111111',
      socialLinks: {},
      pugActiveBan: {},
      pugBanOffenseCount: 0,
      isInactive: false,
      showInLiveStreamers: false,
      loginAttempts: 0,
      departments: { ...defaultDepartments },
    })
    const createAs = (req: any, data: any) =>
      enforcePersonAccessChange({ req, data, originalDoc: undefined, operation: 'create' })

    it('lets a team manager create a person through the stock form despite the injected defaults', async () => {
      const req = reqForTeamManager({ id: 3, role: 'user' })
      await expect(createAs(req, mergedCreateDoc())).resolves.toBeUndefined()
    })

    it('still rejects a real titles change smuggled in alongside the defaults', async () => {
      const req = reqForTeamManager({ id: 3, role: 'user' })
      await expect(createAs(req, { ...mergedCreateDoc(), titles: [{ title: 'owner' }] })).rejects.toMatchObject({ status: 403 })
    })

    it('still rejects a password set outside identityCreate context', async () => {
      const req = reqForTeamManager({ id: 3, role: 'user' })
      await expect(createAs(req, { ...mergedCreateDoc(), password: 'x' })).rejects.toMatchObject({ status: 403 })
    })

    it('still rejects an email set outside identityCreate context', async () => {
      const req = reqForTeamManager({ id: 3, role: 'user' })
      await expect(createAs(req, { ...mergedCreateDoc(), email: 'a@b.c' })).rejects.toMatchObject({ status: 403 })
    })

    it('rejects a department flag from a plain team manager, but lets a matching department lead set it', async () => {
      const doc = { ...mergedCreateDoc(), departments: { ...defaultDepartments, isGraphicsStaff: true } }

      const managerReq = reqForTeamManager({ id: 3, role: 'user' })
      await expect(createAs(managerReq, doc)).rejects.toMatchObject({ status: 403 })

      const graphicsLeadReq = reqForTeamManager({ id: 3, role: 'user', titles: [{ title: 'graphics', isLead: true }] })
      await expect(createAs(graphicsLeadReq, doc)).resolves.toBeUndefined()
    })
  })

  it('strips client-supplied timestamps on a non-staff write', async () => {
    const req = reqFor({ id: 50, role: 'user' })
    const data: any = { bio: 'x', createdAt: '2020-01-01', updatedAt: '2020-01-01' }
    await expect(enforcePersonAccessChange({ req, data, originalDoc: original, operation: 'update' })).resolves.toBeUndefined()
    expect('createdAt' in data).toBe(false)
    expect('updatedAt' in data).toBe(false)
  })
})

describe('authenticatedRead', () => {
  it('is false with no user and true for any authenticated user', () => {
    expect(authenticatedRead({ req: { user: null } } as any)).toBe(false)
    expect(authenticatedRead({ req: { user: { id: 1 } } } as any)).toBe(true)
  })
})

describe('People.teamAccess field access', () => {
  it('read is gated to authenticated users (regression: was public via collection default)', async () => {
    const { People } = await import('@/collections/People')
    const findField = (fields: any[]): any => {
      for (const f of fields) {
        if (f.name === 'teamAccess') return f
        if (f.fields) {
          const nested = findField(f.fields)
          if (nested) return nested
        }
        if (f.tabs) {
          for (const tab of f.tabs) {
            const nested = findField(tab.fields)
            if (nested) return nested
          }
        }
      }
      return null
    }
    const teamAccessField = findField(People.fields as any[])
    expect(teamAccessField).toBeTruthy()
    expect(await teamAccessField.access.read({ req: { user: null } } as any)).toBe(false)
    expect(await teamAccessField.access.read({ req: { user: { id: 1 } } } as any)).toBe(true)
  })
})
