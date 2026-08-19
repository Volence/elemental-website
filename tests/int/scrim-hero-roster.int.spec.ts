/**
 * Guards the hero roster against staleness as Blizzard ships new heroes.
 *
 * getRoleForHero defaults unknown heroes to 'Damage', which silently
 * misclassifies new tanks/supports in role-based analytics - so every
 * released hero must be explicitly present in heroRoleMapping.
 */

import { describe, it, expect } from 'vitest'
import { heroRoleMapping, getRoleForHero } from '@/lib/scrim-parser/heroes'

describe('hero roster', () => {
  it('classifies D.Mon as a Tank (Season 4 2026 release)', () => {
    expect(heroRoleMapping['D.Mon']).toBe('Tank')
    expect(getRoleForHero('D.Mon')).toBe('Tank')
  })

  it('explicitly maps Shion as Damage (Season 3 2026 release)', () => {
    // Shion would "work" via the unknown-hero Damage default; assert the
    // explicit mapping so the roster stays a complete document of the game.
    expect(heroRoleMapping['Shion']).toBe('Damage')
  })
})
