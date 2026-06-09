import { describe, it, expect } from 'vitest'
import { diffRoles, diffNickname, truncate } from '@/discord/logging/diff'

describe('diff helpers', () => {
  it('diffs role id sets into added/removed', () => {
    expect(diffRoles(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] })
  })
  it('reports no role change as empty arrays', () => {
    expect(diffRoles(['a'], ['a'])).toEqual({ added: [], removed: [] })
  })
  it('diffs nickname old -> new, treating null as none', () => {
    expect(diffNickname(null, 'Ace')).toEqual({ from: null, to: 'Ace', changed: true })
    expect(diffNickname('Ace', 'Ace')).toEqual({ from: 'Ace', to: 'Ace', changed: false })
  })
  it('truncates long content and marks it', () => {
    expect(truncate('hello', 10)).toBe('hello')
    expect(truncate('abcdefghijkl', 5)).toBe('abcde...')
  })
})
