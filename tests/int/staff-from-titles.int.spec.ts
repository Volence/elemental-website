import { describe, it, expect } from 'vitest'
import { groupPeopleByTitle, titlesOf, splitProductionRoster, type ProductionRosterRow } from '@/utilities/staffFromTitles'
import { titleLabel, type TitleValue } from '@/access/titles'

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

describe('productionRoster', () => {
  it('lists each production person once, casters first, leads first, with title labels', async () => {
    const { groupPeopleByTitle, productionRoster } = await import('@/utilities/staffFromTitles')
    const prod = [
      { id: 10, name: 'Dan', titles: [{ title: 'observer' as const }, { title: 'producer' as const, isLead: true }] },
      { id: 11, name: 'Gobbi', titles: [{ title: 'observer' as const }, { title: 'producer' as const }] },
      { id: 12, name: 'Bo', titles: [{ title: 'caster' as const, isLead: true }] },
      { id: 13, name: 'Ana', titles: [{ title: 'caster' as const }, { title: 'graphics' as const, isLead: true }] },
      { id: 14, name: 'Zed', titles: [{ title: 'hr' as const }] },
    ]
    const roster = productionRoster(groupPeopleByTitle(prod as any))
    expect(roster.map((r) => r.person.name)).toEqual(['Bo', 'Ana', 'Dan', 'Gobbi'])
    expect(roster.map((r) => r.isLead)).toEqual([true, false, true, false])
    expect(roster.find((r) => r.person.name === 'Dan')!.titles.map((t) => t.label)).toEqual(['Observer', 'Lead Producer'])
    expect(roster.find((r) => r.person.name === 'Ana')!.titles.map((t) => t.label)).toEqual(['Caster'])
  })
})

describe('splitProductionRoster', () => {
  const row = (id: number, name: string, titles: Array<[TitleValue, boolean]>): ProductionRosterRow => ({
    person: { id, name } as any,
    titles: titles.map(([title, isLead]) => ({ title, label: titleLabel({ title, isLead }), isLead })),
    isLead: titles.some(([, l]) => l),
  })

  it('casters stand apart, observers and producers stay combined, and a person on both sides appears in each with only that side\'s titles', () => {
    const rows = [
      row(1, 'Ana', [['caster', false]]),
      row(2, 'Dan', [['observer', false], ['producer', true]]),
      row(3, 'Kim', [['caster', true], ['observer', false]]),
    ]
    const { casters, crew } = splitProductionRoster(rows)
    expect(casters.map((r) => [r.person.name, r.titles.map((t) => t.label), r.isLead])).toEqual([
      ['Ana', ['Caster'], false],
      ['Kim', ['Lead Caster'], true],
    ])
    expect(crew.map((r) => [r.person.name, r.titles.map((t) => t.label), r.isLead])).toEqual([
      ['Dan', ['Observer', 'Lead Producer'], true],
      ['Kim', ['Observer'], false],
    ])
  })

  it('counts directors as broadcast crew, not casters', () => {
    const { casters, crew } = splitProductionRoster([row(4, 'Rae', [['director', true]])])
    expect(casters).toEqual([])
    expect(crew.map((r) => [r.person.name, r.titles.map((t) => t.label)])).toEqual([['Rae', ['Lead Director']]])
  })
})
