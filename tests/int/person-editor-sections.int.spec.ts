import { describe, it, expect } from 'vitest'
import { resolveAccess } from '@/access/resolve'
import { matchTeams } from '@/components/PersonEditor/TeamAccessSection'
import { extraAccessRows } from '@/components/PersonEditor/ExtraAccessSection'

const noTeams: any[] = []
const admin = resolveAccess({ id: 1, role: 'admin' }, noTeams)
const socialLead = resolveAccess({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] }, noTeams)
const plain = resolveAccess({ id: 4, role: 'user' }, noTeams)

describe('matchTeams', () => {
  const teams = [
    { id: 1, name: 'Elemental Bug' },
    { id: 2, name: 'Elemental Fire' },
    { id: 3, name: 'Firefly Academy' },
    { id: 4, name: 'Elemental Ice' },
  ]

  it('offers nothing for an empty query', () => {
    expect(matchTeams(teams, '   ', [])).toEqual([])
  })

  it('matches case-insensitively, prefix matches first, then alphabetical', () => {
    expect(matchTeams(teams, 'fire', []).map((t) => t.name)).toEqual(['Firefly Academy', 'Elemental Fire'])
  })

  it('excludes already selected teams and respects the cap', () => {
    expect(matchTeams(teams, 'elemental', [2]).map((t) => t.id)).toEqual([1, 4])
    expect(matchTeams(teams, 'e', [], 2)).toHaveLength(2)
  })
})

describe('extraAccessRows', () => {
  const marketingTitles = [{ title: 'marketing' as const, isLead: true }]

  it('a title-covered department renders as a locked granted pill when the flag is off', () => {
    const rows = extraAccessRows({}, marketingTitles, admin)
    const social = rows.find((r) => r.flag.key === 'isSocialMediaStaff')!
    const graphics = rows.find((r) => r.flag.key === 'isGraphicsStaff')!
    const production = rows.find((r) => r.flag.key === 'isProductionStaff')!
    expect(social.control).toBe('granted')
    expect(social.granter?.title).toBe('marketing')
    expect(graphics.control).toBe('granted')
    expect(production.control).toBe('toggle')
  })

  it('a redundant flag that is on keeps its toggle so it can be cleared', () => {
    const rows = extraAccessRows({ isSocialMediaStaff: true }, marketingTitles, admin)
    const social = rows.find((r) => r.flag.key === 'isSocialMediaStaff')!
    expect(social.control).toBe('toggle')
    expect(social.active).toBe(true)
    expect(social.granter?.title).toBe('marketing')
  })

  it('hides the retired Scouting flag unless it is on', () => {
    expect(extraAccessRows({}, [], admin).some((r) => r.flag.key === 'isScoutingStaff')).toBe(false)
    expect(extraAccessRows({ isScoutingStaff: true }, [], admin).find((r) => r.flag.key === 'isScoutingStaff')?.control).toBe('toggle')
  })

  it('a department lead only edits their own department flag; others show only when on', () => {
    const rows = extraAccessRows({ isGraphicsStaff: true }, [], socialLead)
    expect(rows.map((r) => [r.flag.key, r.control])).toEqual([
      ['isSocialMediaStaff', 'toggle'],
      ['isGraphicsStaff', 'on'],
    ])
  })

  it('a plain viewer sees nothing when no flags are on', () => {
    expect(extraAccessRows({}, [], plain)).toEqual([])
  })
})
