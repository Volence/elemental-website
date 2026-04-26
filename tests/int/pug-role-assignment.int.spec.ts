import { describe, it, expect } from 'vitest'
import { findValidAssignment } from '../../src/pug/roleAssignment'

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
      p(3, ['flex-dps']), p(4, ['flex-dps']),
      p(5, ['hitscan-dps']), p(6, ['hitscan-dps']),
      p(7, ['flex-support']), p(8, ['flex-support']),
      p(9, ['main-support']), p(10, ['main-support']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
    const assignedIds = result!.map((a) => a.userId)
    expect(new Set(assignedIds).size).toBe(10)
    const roleCounts: Record<string, number> = {}
    result!.forEach((a) => { roleCounts[a.assignedRole] = (roleCounts[a.assignedRole] ?? 0) + 1 })
    expect(roleCounts['tank']).toBe(2)
    expect(roleCounts['flex-dps']).toBe(2)
    expect(roleCounts['hitscan-dps']).toBe(2)
    expect(roleCounts['flex-support']).toBe(2)
    expect(roleCounts['main-support']).toBe(2)
  })

  it('handles players with multiple roles', () => {
    const players = [
      p(1, ['tank']), p(2, ['tank']),
      p(3, ['flex-dps', 'hitscan-dps']), p(4, ['flex-dps', 'hitscan-dps']),
      p(5, ['flex-dps', 'hitscan-dps']), p(6, ['flex-dps', 'hitscan-dps']),
      p(7, ['flex-support', 'main-support']), p(8, ['flex-support', 'main-support']),
      p(9, ['flex-support', 'main-support']), p(10, ['flex-support', 'main-support']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
  })

  it('prefers earlier-joined players when multiple valid assignments exist', () => {
    const players = [
      p(1, ['tank']), p(2, ['tank']),
      p(3, ['flex-dps']), p(4, ['flex-dps']),
      p(5, ['hitscan-dps']), p(6, ['hitscan-dps']),
      p(7, ['flex-support']), p(8, ['flex-support']),
      p(9, ['main-support']), p(10, ['main-support']),
      p(11, ['tank']), p(12, ['flex-dps']),
    ]
    const result = findValidAssignment(players)
    expect(result).not.toBeNull()
    const assignedIds = result!.map((a) => a.userId)
    expect(assignedIds).not.toContain(11)
    expect(assignedIds).not.toContain(12)
  })
})
