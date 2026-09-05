import { describe, it, expect } from 'vitest'
import { productionTypeToTitles, orgRoleToTitle, impliedFlagsForTitles } from '@/migrations/titlesDataMapping'

describe('titles data mapping', () => {
  it('splits combined production types', () => {
    expect(productionTypeToTitles('caster')).toEqual(['caster'])
    expect(productionTypeToTitles('observer-producer')).toEqual(['observer', 'producer'])
    expect(productionTypeToTitles('observer-producer-caster')).toEqual(['observer', 'producer', 'caster'])
    expect(productionTypeToTitles('nonsense')).toEqual([])
  })
  it('maps org roles one to one and drops retired ones', () => {
    expect(orgRoleToTitle('region-lead')).toBe('region-lead')
    expect(orgRoleToTitle('moderator')).toBeNull()
  })
  it('lists the flags a title set makes redundant', () => {
    expect(impliedFlagsForTitles(['marketing'])).toEqual(['isSocialMediaStaff', 'isGraphicsStaff'])
    expect(impliedFlagsForTitles(['event-manager'])).toEqual(['isEventsStaff', 'isPugAdmin'])
    expect(impliedFlagsForTitles(['owner'])).toEqual([])
  })
})
