import { describe, it, expect } from 'vitest'
import { groupPeopleByTitle, titlesOf } from '@/utilities/staffFromTitles'

const people = [
  { id: 1, name: 'Ana', titles: [{ title: 'caster' as const }, { title: 'graphics' as const, isLead: true }] },
  { id: 2, name: 'Bo', titles: [{ title: 'caster' as const, isLead: true }] },
  { id: 3, name: 'Cy', titles: [{ title: 'region-lead' as const, regions: ['emea'] }] },
  { id: 4, name: 'Di', titles: [] },
]

describe('groupPeopleByTitle', () => {
  it('groups in TITLES order, leads first, omits empty groups', () => {
    const groups = groupPeopleByTitle(people as any)
    expect(groups.map((g) => g.title)).toEqual(['region-lead', 'graphics', 'caster'])
    const casters = groups.find((g) => g.title === 'caster')!
    expect(casters.members.map((m) => m.person.name)).toEqual(['Bo', 'Ana'])
    expect(casters.members[0].isLead).toBe(true)
    expect(groups.find((g) => g.title === 'region-lead')!.members[0].regions).toEqual(['emea'])
  })
  it('titlesOf renders lead labels', () => {
    expect(titlesOf(people[0] as any).map((t) => t.label)).toEqual(['Caster', 'Graphics Lead'])
  })
})
