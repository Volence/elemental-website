import { describe, it, expect, vi } from 'vitest'
import { adminOnly, staffManagerOrAbove, department, anyDepartment, teamManager, teamScoped, withAccess, hideUnless } from '@/access'
import { getTeamsForAccess, invalidateTeamsCache } from '@/access/teamsCache'

const teams = [{ id: 1, region: 'NA', manager: [{ person: 10 }] }, { id: 2, region: 'EMEA' }]
const payload = { find: vi.fn(async () => ({ docs: teams })) } as any
const req = (user: any) => ({ user, payload, context: {} }) as any

describe('access wrappers', () => {
  it('adminOnly and staffManagerOrAbove', async () => {
    expect(await adminOnly({ req: req({ id: 1, role: 'admin' }) } as any)).toBe(true)
    expect(await adminOnly({ req: req({ id: 1, role: 'staff-manager' }) } as any)).toBe(false)
    expect(await staffManagerOrAbove({ req: req({ id: 1, role: 'staff-manager' }) } as any)).toBe(true)
    expect(await staffManagerOrAbove({ req: req({ id: 1, role: 'user', titles: [{ title: 'hr' }] }) } as any)).toBe(true)
    expect(await staffManagerOrAbove({ req: req(null) } as any)).toBe(false)
  })
  it('department wrappers honor levels and flags', async () => {
    expect(await department('social')({ req: req({ id: 1, role: 'user', titles: [{ title: 'marketing' }] }) } as any)).toBe(true)
    expect(await department('social', 'lead')({ req: req({ id: 1, role: 'user', titles: [{ title: 'marketing' }] }) } as any)).toBe(false)
    expect(await department('pug')({ req: req({ id: 1, role: 'user', departments: { isPugAdmin: true } }) } as any)).toBe(true)
    expect(await anyDepartment()({ req: req({ id: 1, role: 'user' }) } as any)).toBe(false)
  })
  it('teamManager checks the document id against teamIds', async () => {
    expect(await teamManager()({ req: req({ id: 10, role: 'user' }), id: 1 } as any)).toBe(true)
    expect(await teamManager()({ req: req({ id: 10, role: 'user' }), id: 2 } as any)).toBe(false)
    expect(await teamManager()({ req: req({ id: 10, role: 'user' }) } as any)).toBe(false)
    expect(await teamManager()({ req: req({ id: 1, role: 'staff-manager' }), id: 2 } as any)).toBe(true)
  })
  it('teamScoped returns a where clause for non-staff', async () => {
    expect(await teamScoped('team')({ req: req({ id: 1, role: 'admin' }) } as any)).toBe(true)
    expect(await teamScoped('team')({ req: req({ id: 10, role: 'user' }) } as any)).toEqual({ team: { in: [1] } })
    expect(await teamScoped('team')({ req: req({ id: 1, role: 'user' }) } as any)).toBe(false)
  })
  it('withAccess passes the resolved access and memoizes per request', async () => {
    const r = req({ id: 10, role: 'user' })
    const seen: any[] = []
    const fn = withAccess((a) => { seen.push(a); return a.teamIds.has(1) })
    expect(await fn({ req: r } as any)).toBe(true)
    expect(await fn({ req: r } as any)).toBe(true)
    expect(seen[0]).toBe(seen[1])
  })
  it('hideUnless works without teams', () => {
    const hidden = hideUnless((a) => a.canManagePeople)
    expect(hidden({ user: { id: 1, role: 'user' } })).toBe(true)
    expect(hidden({ user: { id: 1, role: 'user', titles: [{ title: 'hr' }] } })).toBe(false)
    expect(hidden({ user: null })).toBe(true)
  })
  it('getTeamsForAccess recovers after a rejected fetch', async () => {
    invalidateTeamsCache()
    const flaky = {
      find: vi.fn()
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce({ docs: teams }),
    } as any
    await expect(getTeamsForAccess(flaky)).rejects.toThrow('db down')
    await expect(getTeamsForAccess(flaky)).resolves.toEqual([
      { id: 1, region: 'NA', manager: [{ person: 10 }], coaches: [], captain: [] },
      { id: 2, region: 'EMEA', manager: [], coaches: [], captain: [] },
    ])
    expect(flaky.find).toHaveBeenCalledTimes(2)
  })
})
