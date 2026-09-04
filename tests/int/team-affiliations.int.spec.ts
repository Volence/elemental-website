import { describe, it, expect } from 'vitest'
import { affiliationsFromTeams, affiliationLabel } from '@/utilities/teamAffiliations'

const steel = { name: 'Steel', slug: 'steel', active: true, roster: [{ person: 1 }, { person: { id: 2 } }], subs: [{ person: 3 }], coaches: [{ person: 4 }], manager: [{ person: 5 }], coCaptain: 6 }
const retired = { name: 'Old', slug: 'old', active: false, roster: [{ person: 7 }] }
const water = { name: 'Water', slug: 'water', active: true, roster: [{ person: 4 }] }

describe('affiliationsFromTeams', () => {
  it('labels players, subs, coaches and managers', () => {
    const m = affiliationsFromTeams([steel], [1, 2, 3, 4, 5, 6, 99])
    expect(m.get(1)).toEqual({ teamName: 'Steel', teamSlug: 'steel', role: 'Player' })
    expect(m.get(2)?.role).toBe('Player')
    expect(m.get(3)?.role).toBe('Sub')
    expect(m.get(4)?.role).toBe('Coach')
    expect(m.get(5)?.role).toBe('Manager')
    expect(m.get(6)?.role).toBe('Player')
    expect(m.has(99)).toBe(false)
    expect(affiliationLabel(m.get(4)!)).toBe('Coach for Steel')
  })

  it('skips inactive teams and prefers playing over coaching', () => {
    const m = affiliationsFromTeams([steel, retired, water], [4, 7])
    expect(m.has(7)).toBe(false)
    expect(m.get(4)).toEqual({ teamName: 'Water', teamSlug: 'water', role: 'Player' })
  })
})
