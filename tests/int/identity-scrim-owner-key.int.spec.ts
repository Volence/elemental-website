import { describe, it, expect } from 'vitest'
import { scrimOwnerKey } from '@/lib/scrim-analytics/ownerKey'

describe('scrimOwnerKey', () => {
  it('uses the email when the account has one', () => {
    expect(scrimOwnerKey({ email: 'coach@example.com', discordId: '111111111111111111' })).toBe('coach@example.com')
  })
  it('falls back to a synthetic key for a Discord-only account', () => {
    expect(scrimOwnerKey({ email: null, discordId: '111111111111111111' })).toBe('discord_111111111111111111@elmt.placeholder')
  })
  it('returns null when the account has neither', () => {
    expect(scrimOwnerKey({ email: null, discordId: null })).toBeNull()
  })
})
