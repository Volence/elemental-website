import { describe, it, expect } from 'vitest'
import { relId, activeDepartments, isElevated, buildTeamStandingIndex } from '@/accessReview/compute'

describe('relId', () => {
  it('reads an id from a number, an object, or neither', () => {
    expect(relId(7)).toBe(7)
    expect(relId({ id: 7 })).toBe(7)
    expect(relId(null)).toBe(null)
    expect(relId({ nope: true })).toBe(null)
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
