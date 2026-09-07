import { describe, it, expect } from 'vitest'
import { resolveAccess, impliedRole, hasDepartment, canManageTeam, serializeAccess, deserializeAccess } from '@/access/resolve'
import { DEPARTMENT_KEYS } from '@/access/titles'

const teams = [
  { id: 1, region: 'NA', manager: [{ person: 10 }], coaches: [{ person: { id: 11 } }], captain: [{ person: 12 }] },
  { id: 2, region: 'EMEA', manager: [], coaches: [], captain: [] },
  { id: 3, region: 'emea', manager: [{ person: 99 }] },
]

describe('resolveAccess: roles', () => {
  it('admin is lead everywhere and manages every team', () => {
    const a = resolveAccess({ id: 1, role: 'admin' }, teams)
    expect(a.isAdmin).toBe(true)
    expect(a.departments.social).toBe('lead')
    expect([...a.teamIds].sort()).toEqual([1, 2, 3])
    expect(a.teamReasons[2]).toEqual(['staff'])
    expect(a.canManagePeople).toBe(true)
  })
  it('staff-manager is lead everywhere and manages every team but is not admin', () => {
    const a = resolveAccess({ id: 1, role: 'staff-manager' }, teams)
    expect(a.isAdmin).toBe(false)
    expect(a.isStaffManager).toBe(true)
    expect(a.departments.production).toBe('lead')
    expect(a.teamIds.size).toBe(3)
  })
  it('legacy team-manager and player roles resolve as user', () => {
    expect(resolveAccess({ id: 1, role: 'team-manager' }, teams).role).toBe('user')
    expect(resolveAccess({ id: 1, role: 'player' }, teams).role).toBe('user')
    expect(resolveAccess({ id: 1, role: null }, teams).role).toBe('user')
  })
  it('titles raise the effective role', () => {
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'owner' }] }, teams).role).toBe('admin')
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'hr' }] }, teams).role).toBe('staff-manager')
    expect(resolveAccess({ id: 1, role: 'admin', titles: [{ title: 'hr' }] }, teams).role).toBe('admin')
  })
})

describe('resolveAccess: departments', () => {
  it('a title grants member level in its departments only', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'event-manager' }] }, teams)
    expect(a.departments.events).toBe('member')
    expect(a.departments.pug).toBe('member')
    expect(a.departments.video).toBe('none')
    expect(a.leadDepartments).toEqual([])
  })
  it('a title with no departments (marketing) grants none', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'marketing', isLead: true }] }, teams)
    expect(DEPARTMENT_KEYS.every((k) => a.departments[k] === 'none')).toBe(true)
    expect(a.leadDepartments).toEqual([])
  })
  it('the lead flag raises that title\'s departments to lead', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'event-manager', isLead: true }] }, teams)
    expect(a.departments.events).toBe('lead')
    expect(a.departments.pug).toBe('lead')
    expect(a.leadDepartments).toEqual(['events', 'pug'])
  })
  it('the lead flag is ignored on titles without a lead label', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'observer', isLead: true }] }, teams)
    expect(a.departments.production).toBe('member')
  })
  it('extra-access flags grant member level and never lead', () => {
    const a = resolveAccess({ id: 1, role: 'user', departments: { isGraphicsStaff: true, isPugAdmin: true } }, teams)
    expect(a.departments.graphics).toBe('member')
    expect(a.departments.pug).toBe('member')
    expect(a.departments.social).toBe('none')
  })
  it('member from a flag plus lead from a title yields lead', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'graphics', isLead: true }], departments: { isGraphicsStaff: true } }, teams)
    expect(a.departments.graphics).toBe('lead')
  })
  it('standalone flags', () => {
    const a = resolveAccess({ id: 1, role: 'user', departments: { canUploadExternalScrims: true, isContentCreator: true } }, teams)
    expect(a.canUploadExternalScrims).toBe(true)
    expect(a.isContentCreator).toBe(true)
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'content-creator' }] }, teams).isContentCreator).toBe(true)
  })
  it('hasDepartment respects levels', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'caster' }] }, teams)
    expect(hasDepartment(a, 'production')).toBe(true)
    expect(hasDepartment(a, 'production', 'lead')).toBe(false)
    expect(hasDepartment(a, 'social')).toBe(false)
  })
})

describe('resolveAccess: teams', () => {
  it('manager, coach, captain membership grants access with reasons', () => {
    expect(resolveAccess({ id: 10, role: 'user' }, teams).teamReasons[1]).toEqual(['manager'])
    expect(resolveAccess({ id: 11, role: 'user' }, teams).teamReasons[1]).toEqual(['coach'])
    expect(resolveAccess({ id: 12, role: 'user' }, teams).teamReasons[1]).toEqual(['captain'])
    expect(canManageTeam(resolveAccess({ id: 12, role: 'user' }, teams), 1)).toBe(true)
    expect(canManageTeam(resolveAccess({ id: 12, role: 'user' }, teams), 2)).toBe(false)
  })
  it('roster and subs grant nothing', () => {
    const t = [{ id: 5, roster: [{ person: 7 }], subs: [{ person: 7 }] }] as any
    expect(resolveAccess({ id: 7, role: 'user' }, t).teamIds.size).toBe(0)
  })
  it('region lead covers every team in its regions, case-insensitively', () => {
    const a = resolveAccess({ id: 1, role: 'user', titles: [{ title: 'region-lead', regions: ['emea'] }] }, teams)
    expect([...a.teamIds].sort()).toEqual([2, 3])
    expect(a.teamReasons[3]).toEqual(['region-lead'])
  })
  it('teamAccess grants access-only', () => {
    const a = resolveAccess({ id: 1, role: 'user', teamAccess: [2, { id: 3 }] }, teams)
    expect([...a.teamIds].sort()).toEqual([2, 3])
    expect(a.teamReasons[2]).toEqual(['access-only'])
  })
  it('reasons accumulate', () => {
    const a = resolveAccess({ id: 10, role: 'user', teamAccess: [1] }, teams)
    expect(a.teamReasons[1]).toEqual(['manager', 'access-only'])
  })
  it('reasons do not duplicate when the same team appears twice in teamAccess', () => {
    const a = resolveAccess({ id: 1, role: 'user', teamAccess: [2, { id: 2 }] }, teams)
    expect(a.teamReasons[2]).toEqual(['access-only'])
  })
  it('canPickMembers is true for team access or any department', () => {
    expect(resolveAccess({ id: 10, role: 'user' }, teams).canPickMembers).toBe(true)
    expect(resolveAccess({ id: 1, role: 'user', titles: [{ title: 'caster' }] }, teams).canPickMembers).toBe(true)
    expect(resolveAccess({ id: 1, role: 'user' }, teams).canPickMembers).toBe(false)
  })
})

describe('impliedRole and serialization', () => {
  it('impliedRole picks the highest', () => {
    expect(impliedRole([{ title: 'hr' }, { title: 'co-owner' }])).toBe('admin')
    expect(impliedRole([{ title: 'hr' }])).toBe('staff-manager')
    expect(impliedRole([{ title: 'caster' }])).toBeNull()
    expect(impliedRole(null)).toBeNull()
  })
  it('round-trips through JSON', () => {
    const a = resolveAccess({ id: 10, role: 'user', titles: [{ title: 'caster', isLead: true }] }, teams)
    const back = deserializeAccess(JSON.parse(JSON.stringify(serializeAccess(a))))
    expect([...back.teamIds]).toEqual([...a.teamIds])
    expect(back.departments).toEqual(a.departments)
  })
})
