import { describe, it, expect } from 'vitest'
import {
  DRAFT_PICK_ORDER,
  getNextPickTeam,
  applyPick,
  getAutoPick,
  isDraftComplete,
} from '../../src/pug/draftEngine'
import type { DraftPick, AssignedPlayer } from '../../src/pug/types'

describe('DRAFT_PICK_ORDER', () => {
  it('is [1, 2, 2, 1, 1, 2, 2, 1] (1-2-2-2-1 snake)', () => {
    expect(DRAFT_PICK_ORDER).toEqual([1, 2, 2, 1, 1, 2, 2, 1])
  })
})

describe('getNextPickTeam', () => {
  it('returns team 1 for pickNumber 0', () => { expect(getNextPickTeam(0)).toBe(1) })
  it('returns team 2 for pickNumber 1', () => { expect(getNextPickTeam(1)).toBe(2) })
  it('returns team 2 for pickNumber 2', () => { expect(getNextPickTeam(2)).toBe(2) })
  it('returns null when draft is complete (pickNumber >= 8)', () => { expect(getNextPickTeam(8)).toBeNull() })
})

describe('applyPick', () => {
  it('assigns the picked player to the correct team', () => {
    const players: AssignedPlayer[] = [
      { userId: 3, assignedRole: 'flex_dps', team: null, isCaptain: false, rating: 1500 },
      { userId: 4, assignedRole: 'flex_dps', team: null, isCaptain: false, rating: 1400 },
    ]
    const updated = applyPick(players, [], 3, 1, 0)
    expect(updated.find((p) => p.userId === 3)?.team).toBe(1)
  })
  it('throws if playerUserId is not in the undrafted pool', () => {
    const players: AssignedPlayer[] = [
      { userId: 3, assignedRole: 'flex_dps', team: null, isCaptain: false, rating: 1500 },
    ]
    expect(() => applyPick(players, [], 99, 1, 0)).toThrow()
  })
})

describe('getAutoPick', () => {
  it('returns the undrafted player with the highest rating', () => {
    const players: AssignedPlayer[] = [
      { userId: 3, assignedRole: 'flex_dps', team: null, isCaptain: false, rating: 1600 },
      { userId: 4, assignedRole: 'flex_dps', team: null, isCaptain: false, rating: 1400 },
    ]
    expect(getAutoPick(players)).toBe(3)
  })
})

describe('isDraftComplete', () => {
  it('returns false when pickNumber < 8', () => { expect(isDraftComplete(7)).toBe(false) })
  it('returns true when pickNumber === 8', () => { expect(isDraftComplete(8)).toBe(true) })
})
