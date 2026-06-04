import { describe, it, expect } from 'vitest'
import { pickStandout } from '../../src/components/MatchStats/standout'

const p = (name: string, eliminations: number, deaths: number) =>
  ({ name, eliminations, deaths } as any)

describe('pickStandout', () => {
  it('picks most eliminations', () => {
    expect(pickStandout([p('A', 10, 2), p('B', 12, 9)])?.name).toBe('B')
  })
  it('breaks ties by fewest deaths', () => {
    expect(pickStandout([p('A', 10, 5), p('C', 10, 1)])?.name).toBe('C')
  })
  it('returns null for empty input', () => {
    expect(pickStandout([])).toBeNull()
  })
})
