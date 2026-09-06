import { describe, it, expect } from 'vitest'
import { resolveAccess } from '@/access/resolve'
import { TITLES } from '@/access/titles'
import { grantableTitles } from '@/components/PersonEditor/TitlesSection'

const noTeams: any[] = []
const admin = resolveAccess({ id: 1, role: 'admin' }, noTeams)
const socialLead = resolveAccess({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] }, noTeams)
const marketingLead = resolveAccess({ id: 3, role: 'user', titles: [{ title: 'marketing', isLead: true }] }, noTeams)
const plain = resolveAccess({ id: 4, role: 'user' }, noTeams)

describe('grantableTitles', () => {
  it('null actor gets nothing', () => {
    expect(grantableTitles(null)).toEqual([])
  })

  it('admin (staff) gets every title', () => {
    expect(grantableTitles(admin)).toEqual(TITLES.map((t) => t.value))
    expect(grantableTitles(admin)).toHaveLength(14)
  })

  it('a social lead gets only social-manager - marketing spans graphics too, so it is excluded', () => {
    expect(grantableTitles(socialLead)).toEqual(['social-manager'])
  })

  it('a marketing lead (social + graphics) gets social-manager, marketing, and graphics', () => {
    expect(grantableTitles(marketingLead)).toEqual(['social-manager', 'marketing', 'graphics'])
  })

  it('a plain member with no lead departments gets nothing', () => {
    expect(grantableTitles(plain)).toEqual([])
  })
})
