import { describe, it, expect } from 'vitest'
import { relId, activeDepartments, isElevated, buildTeamStandingIndex, latestSessionByPerson, latestAccessChangeByPerson } from '@/accessReview/compute'

describe('relId', () => {
  it('reads an id from a number, an object, or neither', () => {
    expect(relId(7)).toBe(7)
    expect(relId({ id: 7 })).toBe(7)
    expect(relId(null)).toBe(null)
    expect(relId({ nope: true } as never)).toBe(null)
  })
})

describe('activeDepartments', () => {
  it('returns only the flags set to true', () => {
    expect(
      activeDepartments({ id: 1, departments: { isGraphicsStaff: true, isEventsStaff: false } }),
    ).toEqual(['isGraphicsStaff'])
  })

  it('returns nothing when departments is missing', () => {
    expect(activeDepartments({ id: 1 })).toEqual([])
  })
})

describe('isElevated', () => {
  it('excludes a plain user with no departments and no teams', () => {
    expect(isElevated({ id: 1, role: 'user' })).toBe(false)
  })

  it('includes any role other than user', () => {
    expect(isElevated({ id: 1, role: 'player' })).toBe(true)
    expect(isElevated({ id: 2, role: 'admin' })).toBe(true)
  })

  it('includes a plain user holding a department flag', () => {
    expect(isElevated({ id: 1, role: 'user', departments: { isPugAdmin: true } })).toBe(true)
  })

  it('includes a plain user with team data access', () => {
    expect(isElevated({ id: 1, role: 'user', assignedTeams: [{ id: 3, name: 'Hydrus' }] })).toBe(
      true,
    )
  })
})

describe('buildTeamStandingIndex', () => {
  const teams = [
    {
      id: 10,
      name: 'Hydrus',
      manager: [{ person: { id: 1 } }],
      coaches: [{ person: 2 }],
      captain: [{ person: { id: 3 } }],
      coCaptain: { id: 4 },
      roster: [{ person: { id: 5 } }],
      subs: [{ person: { id: 6 } }],
    },
  ]

  it('maps every position type to a standing', () => {
    const index = buildTeamStandingIndex(teams)
    const standings = index.get(10)!
    expect(standings.get(1)).toBe('manager')
    expect(standings.get(2)).toBe('coach')
    expect(standings.get(3)).toBe('captain')
    expect(standings.get(4)).toBe('co-captain')
    expect(standings.get(5)).toBe('roster')
    expect(standings.get(6)).toBe('sub')
  })

  it('has no entry for someone not on the team', () => {
    expect(buildTeamStandingIndex(teams).get(10)!.get(99)).toBeUndefined()
  })

  it('keeps the highest standing when a person holds two positions', () => {
    const index = buildTeamStandingIndex([
      { id: 10, name: 'Hydrus', coaches: [{ person: { id: 1 } }], roster: [{ person: { id: 1 } }] },
    ])
    expect(index.get(10)!.get(1)).toBe('coach')
  })
})

describe('latestSessionByPerson', () => {
  it('keeps the newest login and the newest activity per person', () => {
    const map = latestSessionByPerson([
      { user: 1, loginTime: '2026-01-01T00:00:00.000Z', lastActivity: '2026-01-01T02:00:00.000Z' },
      { user: { id: 1 }, loginTime: '2026-03-01T00:00:00.000Z', lastActivity: '2026-02-01T00:00:00.000Z' },
    ])
    expect(map.get(1)).toEqual({
      lastLoginAt: '2026-03-01T00:00:00.000Z',
      lastActivityAt: '2026-02-01T00:00:00.000Z',
    })
  })

  it('ignores rows with no user', () => {
    expect(latestSessionByPerson([{ user: null, loginTime: '2026-01-01T00:00:00.000Z' }]).size).toBe(0)
  })
})

describe('latestAccessChangeByPerson', () => {
  it('keeps the newest entry and names who made it', () => {
    const map = latestAccessChangeByPerson([
      {
        documentId: '5',
        createdAt: '2026-02-01T00:00:00.000Z',
        user: { name: 'Volence' },
        metadata: { accessFields: ['departments.isGraphicsStaff'] },
      },
      {
        documentId: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
        user: { name: 'Someone Else' },
        metadata: { accessFields: ['role'] },
      },
    ])
    expect(map.get(5)).toEqual({
      at: '2026-02-01T00:00:00.000Z',
      byName: 'Volence',
      fields: ['departments.isGraphicsStaff'],
    })
  })

  it('ignores audit entries that touched no access field', () => {
    const map = latestAccessChangeByPerson([
      { documentId: '5', createdAt: '2026-02-01T00:00:00.000Z', metadata: {} },
      { documentId: '5', createdAt: '2026-02-02T00:00:00.000Z', metadata: null },
    ])
    expect(map.size).toBe(0)
  })
})
