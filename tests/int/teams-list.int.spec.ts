import { describe, it, expect } from 'vitest'
import { filterTeams, ratingRank, sortTeams, teamStaffNames, type TeamRow } from '@/components/TeamsList/filters'

const t = (over: Partial<TeamRow> & { id: number; name: string }): TeamRow => ({ updatedAt: '2026-09-01T00:00:00Z', ...over })
const TEAMS: TeamRow[] = [
  t({ id: 1, name: 'Fire', slug: 'fire', region: 'NA', rating: 'FACEIT Masters', roster: [1, 2, 3], subs: [4] }),
  t({ id: 2, name: 'Ice', slug: 'ice', region: 'EMEA', rating: '4.5K', roster: [1, 2, 3, 4, 5], active: false }),
  t({ id: 3, name: 'Storm', slug: 'storm', region: 'NA', rating: '3.5K', roster: [] }),
  t({ id: 4, name: 'Void', slug: 'void', region: 'OCE', rating: null }),
]

describe('filterTeams', () => {
  const base = { search: '', region: 'all', status: 'all', onlyIds: null }
  it('defaults hide nothing and status filters follow the active flag', () => {
    expect(filterTeams(TEAMS, base)).toHaveLength(4)
    expect(filterTeams(TEAMS, { ...base, status: 'active' }).map((x) => x.id)).toEqual([1, 3, 4])
    expect(filterTeams(TEAMS, { ...base, status: 'inactive' }).map((x) => x.id)).toEqual([2])
  })
  it('matches name or slug, and narrows to assigned teams', () => {
    expect(filterTeams(TEAMS, { ...base, search: 'ST' }).map((x) => x.id)).toEqual([3])
    expect(filterTeams(TEAMS, { ...base, region: 'NA' }).map((x) => x.id)).toEqual([1, 3])
    expect(filterTeams(TEAMS, { ...base, onlyIds: [2, 4] }).map((x) => x.id)).toEqual([2, 4])
  })
})

describe('ratingRank and sortTeams', () => {
  it('ranks named tiers above numeric ratings and reads thousands', () => {
    expect(ratingRank('FACEIT Masters')).toBeGreaterThan(ratingRank('FACEIT Expert'))
    expect(ratingRank('FACEIT Expert')).toBeGreaterThan(ratingRank('FACEIT Advanced'))
    expect(ratingRank('FACEIT Advanced')).toBeGreaterThan(ratingRank('FACEIT Intermediate'))
    expect(ratingRank('FACEIT Intermediate')).toBeGreaterThan(ratingRank('FACEIT Open'))
    expect(ratingRank('FACEIT Open')).toBeGreaterThan(ratingRank('4.5K'))
    expect(ratingRank('FACEIT Intermediate ')).toBe(ratingRank('faceit intermediate'))
    expect(ratingRank('FACEIT Expert')).toBeGreaterThan(ratingRank('4.5K'))
    expect(ratingRank('4.5K')).toBe(4500)
    expect(ratingRank('3.5K')).toBeLessThan(ratingRank('4.5K'))
    expect(ratingRank(null)).toBe(-1)
  })
  it('sorts by rating descending and roster size', () => {
    expect(sortTeams(TEAMS, 'rating', 'desc').map((x) => x.id)).toEqual([1, 2, 3, 4])
    expect(sortTeams(TEAMS, 'roster', 'desc').map((x) => x.id)).toEqual([2, 1, 3, 4])
    expect(sortTeams(TEAMS, 'name', 'asc').map((x) => x.name)).toEqual(['Fire', 'Ice', 'Storm', 'Void'])
  })
})

describe('teamStaffNames', () => {
  it('lists manager and coach names once, skipping unpopulated relations', () => {
    const team = t({
      id: 9,
      name: 'X',
      manager: [{ person: { name: 'Ana' } }, { person: 12 }],
      coaches: [{ person: { name: 'Bap' } }, { person: { name: 'Ana' } }],
    })
    expect(teamStaffNames(team, (p) => (p as { name: string }).name)).toEqual(['Ana', 'Bap'])
  })
})
