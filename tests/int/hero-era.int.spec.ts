import { describe, expect, it } from 'vitest'
import { LEGACY_SOMBRA, getRoleForHero, heroBaseName, heroKeyAt } from '@/lib/scrim-parser/heroes'
import { heroNameToSlug } from '@/lib/scrim-parser/heroIcons'

describe('Sombra across the Season 5 role change', () => {
  it('counts Sombra games from before 2026-10-06 as their own Damage hero', () => {
    expect(heroKeyAt('Sombra', new Date('2026-10-05T00:00:00Z'))).toBe(LEGACY_SOMBRA)
    expect(getRoleForHero('Sombra', new Date('2026-10-05T00:00:00Z'))).toBe('Damage')
    expect(getRoleForHero(LEGACY_SOMBRA)).toBe('Damage')
  })

  it('treats Sombra from the patch day on as a Support', () => {
    expect(heroKeyAt('Sombra', new Date('2026-10-06T00:00:00Z'))).toBe('Sombra')
    expect(getRoleForHero('Sombra', '2026-10-09T00:00:00.000Z')).toBe('Support')
    expect(getRoleForHero('Sombra')).toBe('Support')
  })

  it('leaves other heroes alone and maps the legacy name back for portraits', () => {
    expect(heroKeyAt('Tracer', new Date('2025-01-01T00:00:00Z'))).toBe('Tracer')
    expect(getRoleForHero('Doctrine')).toBe('Support')
    expect(heroBaseName(LEGACY_SOMBRA)).toBe('Sombra')
    expect(heroNameToSlug(LEGACY_SOMBRA)).toBe('sombra')
  })
})
