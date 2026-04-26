import { describe, it, expect } from 'vitest'
import { BAN_ORDER, getNextBanTeam, validateBan, applyBan } from '../../src/pug/banPhase'
import type { BanRecord } from '../../src/pug/types'

const heroRoles: Record<number, 'tank' | 'dps' | 'support'> = {
  1: 'tank', 2: 'tank',
  3: 'dps', 4: 'dps', 5: 'dps',
  6: 'support', 7: 'support',
}

describe('BAN_ORDER', () => {
  it('is [2, 1, 2, 1] (team 2 goes first)', () => {
    expect(BAN_ORDER).toEqual([2, 1, 2, 1])
  })
})

describe('validateBan', () => {
  it('allows a valid ban', () => {
    const bans: BanRecord[] = []
    expect(() => validateBan(3, 2, bans, heroRoles)).not.toThrow()
  })

  it('rejects banning a hero that is already banned', () => {
    const bans: BanRecord[] = [{ heroId: 3, team: 2, banNumber: 1 }]
    expect(() => validateBan(3, 1, bans, heroRoles)).toThrow(/already banned/)
  })

  it('rejects banning a 3rd dps hero when 2 dps are already banned', () => {
    const bans: BanRecord[] = [
      { heroId: 3, team: 2, banNumber: 1 },
      { heroId: 4, team: 1, banNumber: 2 },
    ]
    expect(() => validateBan(5, 2, bans, heroRoles)).toThrow(/role ban cap/)
  })
})

describe('getNextBanTeam', () => {
  it('returns 2 for banNumber 1', () => { expect(getNextBanTeam(1)).toBe(2) })
  it('returns 1 for banNumber 2', () => { expect(getNextBanTeam(2)).toBe(1) })
  it('returns null when all 4 bans done (banNumber 5)', () => { expect(getNextBanTeam(5)).toBeNull() })
})
