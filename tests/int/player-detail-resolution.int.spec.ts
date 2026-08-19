import { describe, it, expect } from 'vitest'
import { resolvePlayerStatsTarget } from '../../src/lib/scrim-parser/player-identity'

// A raw scrim name can collide with a People record that was never linked to
// those stat rows (people.name = 'Nojosa' exists, but every
// scrim_player_stats row for 'Nojosa' still has personId = NULL).
//
// Matching the name alone is not proof the Person owns any stats. Routing to
// the person-detail query on a name match alone dead-ends those players on
// "No stats found for this person" even though their rows are right there
// under the raw name.

describe('resolvePlayerStatsTarget', () => {
  it('uses the person when the name matches a Person that owns stat rows', () => {
    expect(
      resolvePlayerStatsTarget({
        playerName: 'Elliena',
        personId: 42,
        personHasLinkedStats: true,
      }),
    ).toEqual({ kind: 'person', personId: 42 })
  })

  it('falls back to the raw name when the matched Person owns no stat rows', () => {
    expect(
      resolvePlayerStatsTarget({
        playerName: 'Nojosa',
        personId: 1228,
        personHasLinkedStats: false,
      }),
    ).toEqual({ kind: 'name', playerName: 'Nojosa' })
  })

  it('uses the raw name when no Person matches the name at all', () => {
    expect(
      resolvePlayerStatsTarget({
        playerName: 'SomeOpponent',
        personId: null,
        personHasLinkedStats: false,
      }),
    ).toEqual({ kind: 'name', playerName: 'SomeOpponent' })
  })

  it('ignores a stale linked-stats flag when there is no matched Person', () => {
    expect(
      resolvePlayerStatsTarget({
        playerName: 'SomeOpponent',
        personId: null,
        personHasLinkedStats: true,
      }),
    ).toEqual({ kind: 'name', playerName: 'SomeOpponent' })
  })
})
