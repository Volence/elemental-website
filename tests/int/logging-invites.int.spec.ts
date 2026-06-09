import { describe, it, expect } from 'vitest'
import { diffInviteUses } from '@/discord/logging/invites'

describe('diffInviteUses', () => {
  it('finds the single invite whose use count increased', () => {
    expect(diffInviteUses({ ABC: 3, DEF: 5 }, { ABC: 4, DEF: 5 })).toEqual({ code: 'ABC', uses: 4 })
  })
  it('handles a brand-new invite code appearing', () => {
    expect(diffInviteUses({ ABC: 3 }, { ABC: 3, NEW: 1 })).toEqual({ code: 'NEW', uses: 1 })
  })
  it('returns null when ambiguous (more than one increased)', () => {
    expect(diffInviteUses({ A: 1, B: 1 }, { A: 2, B: 2 })).toBeNull()
  })
  it('returns null when nothing increased', () => {
    expect(diffInviteUses({ A: 1 }, { A: 1 })).toBeNull()
  })
})
