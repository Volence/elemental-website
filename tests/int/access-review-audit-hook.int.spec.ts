import { describe, it, expect } from 'vitest'
import { diffAccessFields } from '@/collections/People/hooks/auditAccessChanges'

describe('diffAccessFields', () => {
  it('finds nothing when only a profile field changed', () => {
    expect(
      diffAccessFields({ id: 1, role: 'player', bio: 'old' }, { id: 1, role: 'player', bio: 'new' }),
    ).toEqual([])
  })

  it('reports a role change with old and new values', () => {
    expect(diffAccessFields({ id: 1, role: 'admin' }, { id: 1, role: 'user' })).toEqual([
      { field: 'role', from: 'admin', to: 'user' },
    ])
  })

  it('reports only the department flag that changed', () => {
    expect(
      diffAccessFields(
        { id: 1, departments: { isGraphicsStaff: true, isPugAdmin: true } },
        { id: 1, departments: { isGraphicsStaff: false, isPugAdmin: true } },
      ),
    ).toEqual([{ field: 'departments.isGraphicsStaff', from: true, to: false }])
  })

  it('treats a missing department flag as false', () => {
    expect(diffAccessFields({ id: 1 }, { id: 1, departments: { isPugAdmin: true } })).toEqual([
      { field: 'departments.isPugAdmin', from: false, to: true },
    ])
  })

  it('reports team access changes as sorted id lists', () => {
    expect(
      diffAccessFields({ id: 1, teamAccess: [{ id: 11 }, 10] }, { id: 1, teamAccess: [10] }),
    ).toEqual([{ field: 'teamAccess', from: [10, 11], to: [10] }])
  })

  it('ignores reordering of the same teams', () => {
    expect(diffAccessFields({ id: 1, teamAccess: [10, 11] }, { id: 1, teamAccess: [11, 10] })).toEqual([])
  })

  it('returns nothing when there is no previous document', () => {
    expect(diffAccessFields(null, { id: 1, role: 'admin' })).toEqual([])
  })

  it('reports an added title', () => {
    expect(
      diffAccessFields({ id: 1, titles: [] }, { id: 1, titles: [{ title: 'caster' }] }),
    ).toEqual([{ field: 'titles', from: [], to: ['caster|0|'] }])
  })

  it('reports a title gaining the lead flag', () => {
    expect(
      diffAccessFields(
        { id: 1, titles: [{ title: 'caster', isLead: false }] },
        { id: 1, titles: [{ title: 'caster', isLead: true }] },
      ),
    ).toEqual([{ field: 'titles', from: ['caster|0|'], to: ['caster|1|'] }])
  })

  it('ignores reordering of the same titles', () => {
    expect(
      diffAccessFields(
        { id: 1, titles: [{ title: 'caster' }, { title: 'observer' }] },
        { id: 1, titles: [{ title: 'observer' }, { title: 'caster' }] },
      ),
    ).toEqual([])
  })
})
