import { describe, it, expect } from 'vitest'
import { findValidAssignment } from '../../src/pug/roleAssignment'
import { selectCaptains } from '../../src/pug/captainSelection'
import type { AssignedPlayer } from '../../src/pug/types'

const p = (userId: number, roles: string[]) => ({
  userId,
  queuedRoles: roles as any,
  rating: 1500,
})

describe('findValidAssignment', () => {
  it('returns null when fewer than 10 players', () => {
    const players = [p(1, ['tank']), p(2, ['tank'])]
    expect(findValidAssignment(players)).toBeNull()
  })

  it('returns null when no valid assignment exists', () => {
    const players = Array.from({ length: 10 }, (_, i) => p(i + 1, ['tank']))
    expect(findValidAssignment(players)).toBeNull()
  })

  it('finds valid assignment for 10 players each with one role', () => {
    const players = [
      p(1, ['tank']), p(2, ['tank']),
      p(3, ['flex_dps']), p(4, ['flex_dps']),
      p(5, ['hitscan_dps']), p(6, ['hitscan_dps']),
      p(7, ['flex_support']), p(8, ['flex_support']),
      p(9, ['main_support']), p(10, ['main_support']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
    const assignedIds = result!.map((a) => a.userId)
    expect(new Set(assignedIds).size).toBe(10)
    const roleCounts: Record<string, number> = {}
    result!.forEach((a) => { roleCounts[a.assignedRole] = (roleCounts[a.assignedRole] ?? 0) + 1 })
    expect(roleCounts['tank']).toBe(2)
    expect(roleCounts['flex_dps']).toBe(2)
    expect(roleCounts['hitscan_dps']).toBe(2)
    expect(roleCounts['flex_support']).toBe(2)
    expect(roleCounts['main_support']).toBe(2)
  })

  it('handles players with multiple roles', () => {
    const players = [
      p(1, ['tank']), p(2, ['tank']),
      p(3, ['flex_dps', 'hitscan_dps']), p(4, ['flex_dps', 'hitscan_dps']),
      p(5, ['flex_dps', 'hitscan_dps']), p(6, ['flex_dps', 'hitscan_dps']),
      p(7, ['flex_support', 'main_support']), p(8, ['flex_support', 'main_support']),
      p(9, ['flex_support', 'main_support']), p(10, ['flex_support', 'main_support']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
  })

  it('prefers earlier-joined players when multiple valid assignments exist', () => {
    const players = [
      p(1, ['tank']), p(2, ['tank']),
      p(3, ['flex_dps']), p(4, ['flex_dps']),
      p(5, ['hitscan_dps']), p(6, ['hitscan_dps']),
      p(7, ['flex_support']), p(8, ['flex_support']),
      p(9, ['main_support']), p(10, ['main_support']),
      p(11, ['tank']), p(12, ['flex_dps']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    const assignedIds = result!.map((a) => a.userId)
    expect(assignedIds).not.toContain(11)
    expect(assignedIds).not.toContain(12)
  })
})

describe('selectCaptains', () => {
  it('picks the two players from the role with the highest combined MMR', () => {
    const players: AssignedPlayer[] = [
      { userId: 1, assignedRole: 'tank', team: null, isCaptain: false, rating: 2000 },
      { userId: 2, assignedRole: 'tank', team: null, isCaptain: false, rating: 1800 },
      { userId: 3, assignedRole: 'flex_dps', team: null, isCaptain: false, rating: 1600 },
      { userId: 4, assignedRole: 'flex_dps', team: null, isCaptain: false, rating: 1500 },
      { userId: 5, assignedRole: 'hitscan_dps', team: null, isCaptain: false, rating: 1400 },
      { userId: 6, assignedRole: 'hitscan_dps', team: null, isCaptain: false, rating: 1300 },
      { userId: 7, assignedRole: 'flex_support', team: null, isCaptain: false, rating: 1200 },
      { userId: 8, assignedRole: 'flex_support', team: null, isCaptain: false, rating: 1100 },
      { userId: 9, assignedRole: 'main_support', team: null, isCaptain: false, rating: 1000 },
      { userId: 10, assignedRole: 'main_support', team: null, isCaptain: false, rating: 900 },
    ]
    const { captain1Id, captain2Id, captainRole } = selectCaptains(players)
    expect(captainRole).toBe('tank')
    expect(new Set([captain1Id, captain2Id])).toEqual(new Set([1, 2]))
  })
})
