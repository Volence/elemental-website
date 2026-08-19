import { describe, it, expect } from 'vitest'
import { buildGroups, countFlags } from '@/components/AccessReview/grouping'
import type { AccessPerson, AccessReport } from '@/accessReview/types'

const person = (over: Partial<AccessPerson>): AccessPerson => ({
  id: 1,
  name: 'Test',
  email: null,
  avatarUrl: null,
  discordId: null,
  role: 'user',
  departments: [],
  teams: [],
  lastLoginAt: null,
  lastActivityAt: null,
  updatedAt: null,
  lastAccessChange: null,
  inDiscord: null,
  flags: [],
  ...over,
})

const report = (people: AccessPerson[]): AccessReport => ({
  generatedAt: '2026-08-18T00:00:00.000Z',
  discord: { available: true, guildId: 'g' },
  people,
})

describe('buildGroups', () => {
  it('puts a person in their role group, each department, and each team', () => {
    const groups = buildGroups(
      report([
        person({
          id: 1,
          name: 'Multi',
          role: 'staff-manager',
          departments: ['isGraphicsStaff'],
          teams: [{ teamId: 10, teamName: 'Hydrus', standing: null }],
        }),
      ]),
      { search: '', flag: null },
    )
    const keys = groups.map((g) => g.key)
    expect(keys).toContain('role:staff-manager')
    expect(keys).toContain('department:isGraphicsStaff')
    expect(keys).toContain('team:10')
  })

  it('omits empty groups', () => {
    const groups = buildGroups(report([person({ role: 'admin' })]), { search: '', flag: null })
    expect(groups.map((g) => g.key)).toEqual(['role:admin'])
  })

  it('never creates a group for the plain user role', () => {
    const groups = buildGroups(
      report([person({ role: 'user', departments: ['isPugAdmin'] })]),
      { search: '', flag: null },
    )
    expect(groups.map((g) => g.key)).toEqual(['department:isPugAdmin'])
  })

  it('filters by search across name and email', () => {
    const people = [
      person({ id: 1, name: 'Alpha', role: 'admin' }),
      person({ id: 2, name: 'Beta', email: 'beta@elmt.gg', role: 'admin' }),
    ]
    expect(buildGroups(report(people), { search: 'alph', flag: null })[0].people).toHaveLength(1)
    expect(buildGroups(report(people), { search: 'elmt.gg', flag: null })[0].people[0].id).toBe(2)
  })

  it('filters by flag', () => {
    const people = [
      person({ id: 1, name: 'Stale', role: 'admin', flags: ['dormant'] }),
      person({ id: 2, name: 'Fine', role: 'admin', flags: [] }),
    ]
    const groups = buildGroups(report(people), { search: '', flag: 'dormant' })
    expect(groups[0].people.map((p) => p.id)).toEqual([1])
  })

  it('orders bands role, then department, then team', () => {
    const groups = buildGroups(
      report([
        person({ id: 1, name: 'X', role: 'admin', departments: ['isPugAdmin'], teams: [{ teamId: 10, teamName: 'Hydrus', standing: 'roster' }] }),
      ]),
      { search: '', flag: null },
    )
    expect(groups.map((g) => g.band)).toEqual(['role', 'department', 'team'])
  })
})

describe('countFlags', () => {
  it('counts each flag across the report', () => {
    const counts = countFlags(
      report([
        person({ id: 1, flags: ['dormant', 'not-in-discord'] }),
        person({ id: 2, flags: ['dormant'] }),
      ]),
    )
    expect(counts.dormant).toBe(2)
    expect(counts['not-in-discord']).toBe(1)
    expect(counts['team-without-roster']).toBe(0)
    expect(counts['no-review-record']).toBe(0)
  })
})
