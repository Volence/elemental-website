import { describe, it, expect } from 'vitest'
import {
  buildFights,
  computeSingleMapAdvantages,
  aggregateFightAdvantages,
  computeUltEconomy,
  type FightAdvantage,
} from '../../src/lib/scrim-parser/ult-economy'

/**
 * Ult-economy models each team's "ult bank" - how many players hold a charged,
 * unused ultimate - and reports the advantage (our bank - enemy bank) a team
 * carries into each fight, bucketed by size with per-bucket win rates.
 *
 * Adapted from parsertime (MIT). The three pure functions (buildFights,
 * computeSingleMapAdvantages, aggregateFightAdvantages) are ported verbatim in
 * behavior; computeUltEconomy replaces parsertime's framework-coupled
 * orchestration with a plain per-map adapter.
 */

const OURS = 'Us'
const THEM = 'Them'

describe('buildFights', () => {
  it('returns no fights when there are no events', () => {
    expect(buildFights([], [], OURS)).toEqual([])
  })

  it('groups kills within 15s into one fight and splits on a >15s gap', () => {
    const kills = [
      { match_time: 10, attacker_team: OURS, victim_team: THEM },
      { match_time: 20, attacker_team: OURS, victim_team: THEM }, // +10s, same fight
      { match_time: 50, attacker_team: THEM, victim_team: OURS }, // +30s, new fight
    ]
    const fights = buildFights(kills, [], OURS)
    expect(fights.map((f) => f.start)).toEqual([10, 50])
    expect(fights[0].won).toBe(true) // 2-0 ours
    expect(fights[1].won).toBe(false) // 0-1 ours
  })

  it('counts a tie as a loss', () => {
    const kills = [
      { match_time: 5, attacker_team: OURS, victim_team: THEM },
      { match_time: 6, attacker_team: THEM, victim_team: OURS },
    ]
    const fights = buildFights(kills, [], OURS)
    expect(fights).toHaveLength(1)
    expect(fights[0].won).toBe(false) // 1-1 -> loss
  })

  it('a resurrect undoes a kill against the resurrected team', () => {
    // Enemy gets 2 picks on us, we get 1, then one of ours is rez'd: net 1-1 -> loss.
    const kills = [
      { match_time: 5, attacker_team: THEM, victim_team: OURS },
      { match_time: 6, attacker_team: THEM, victim_team: OURS },
      { match_time: 7, attacker_team: OURS, victim_team: THEM },
    ]
    const rezzes = [{ match_time: 8, resurrecter_team: OURS, resurrectee_team: OURS }]
    const fights = buildFights(kills, rezzes, OURS)
    expect(fights[0].won).toBe(false)
  })
})

describe('computeSingleMapAdvantages - ult bank model', () => {
  const base = { mapDataId: 1, ourTeamName: OURS, rezzes: [] as { match_time: number; resurrecter_team: string; resurrectee_team: string }[] }
  const twoKillFight = [
    { match_time: 30, attacker_team: OURS, victim_team: THEM },
    { match_time: 31, attacker_team: OURS, victim_team: THEM },
  ]

  it('returns no advantages when there are no fights', () => {
    expect(computeSingleMapAdvantages({ ...base, kills: [], ults: [], charged: [] })).toEqual([])
  })

  it('counts a charged-but-unused ult as +1 bank entering the fight', () => {
    const out = computeSingleMapAdvantages({
      ...base,
      kills: twoKillFight,
      ults: [],
      charged: [{ match_time: 10, player_team: OURS, player_name: 'A' }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].ourBank).toBe(1)
    expect(out[0].enemyBank).toBe(0)
    expect(out[0].advantage).toBe(1)
  })

  it('a used ult before the fight leaves the bank empty', () => {
    const out = computeSingleMapAdvantages({
      ...base,
      kills: twoKillFight,
      charged: [{ match_time: 10, player_team: OURS, player_name: 'A' }],
      ults: [{ match_time: 20, player_team: OURS, player_name: 'A' }],
    })
    expect(out[0].advantage).toBe(0)
  })

  it('does not double-count repeated charges by the same player', () => {
    const out = computeSingleMapAdvantages({
      ...base,
      kills: twoKillFight,
      charged: [
        { match_time: 10, player_team: OURS, player_name: 'A' },
        { match_time: 12, player_team: OURS, player_name: 'A' },
      ],
      ults: [],
    })
    expect(out[0].ourBank).toBe(1)
  })

  it('nets our and enemy banks into the advantage', () => {
    const out = computeSingleMapAdvantages({
      ...base,
      kills: twoKillFight,
      charged: [
        { match_time: 10, player_team: OURS, player_name: 'A' },
        { match_time: 11, player_team: OURS, player_name: 'B' },
        { match_time: 12, player_team: THEM, player_name: 'X' },
      ],
      ults: [],
    })
    expect(out[0].ourBank).toBe(2)
    expect(out[0].enemyBank).toBe(1)
    expect(out[0].advantage).toBe(1)
  })

  it('only counts events strictly before the fight start', () => {
    const out = computeSingleMapAdvantages({
      ...base,
      kills: twoKillFight, // fight starts at t=30
      charged: [{ match_time: 30, player_team: OURS, player_name: 'A' }], // exactly at start
      ults: [],
    })
    expect(out[0].ourBank).toBe(0)
  })
})

describe('aggregateFightAdvantages', () => {
  it('returns an empty analysis (preserving totalMaps) for no fights', () => {
    const a = aggregateFightAdvantages([], 4)
    expect(a.totalFights).toBe(0)
    expect(a.totalMaps).toBe(4)
    expect(a.buckets.map((b) => b.key)).toEqual(['behind2', 'behind1', 'even', 'ahead1', 'ahead2'])
  })

  it('buckets fights by advantage and computes win rates, shares, and average', () => {
    const fights: FightAdvantage[] = [
      fa({ advantage: 2, won: true }), // ahead2
      fa({ advantage: 1, won: true }), // ahead1
      fa({ advantage: 0, won: false }), // even
      fa({ advantage: -1, won: false }), // behind1
    ]
    const a = aggregateFightAdvantages(fights, 1)
    expect(a.totalFights).toBe(4)
    const ahead2 = a.buckets.find((b) => b.key === 'ahead2')!
    expect(ahead2.fights).toBe(1)
    expect(ahead2.winrate).toBe(100)
    expect(ahead2.share).toBe(25)
    expect(a.winrateAhead).toBe(100)
    expect(a.advantagedShare).toBe(50)
    expect(a.avgAdvantage).toBeCloseTo(0.5, 5) // (2+1+0-1)/4
  })

  it('averages tempo by fight number across maps', () => {
    const fights: FightAdvantage[] = [
      fa({ fightNumber: 1, advantage: 2 }),
      fa({ fightNumber: 1, advantage: 0 }), // fight 1 avg = 1
      fa({ fightNumber: 2, advantage: -1 }),
    ]
    const a = aggregateFightAdvantages(fights, 2)
    const t1 = a.tempo.find((t) => t.fightNumber === 1)!
    expect(t1.avgAdvantage).toBeCloseTo(1, 5)
    expect(t1.samples).toBe(2)
  })
})

describe('computeUltEconomy - end to end', () => {
  it('skips maps that recorded no ult charges', () => {
    const out = computeUltEconomy(
      [
        {
          mapDataId: 1,
          ourTeamName: OURS,
          rezzes: [],
          kills: [
            { match_time: 30, attacker_team: OURS, victim_team: THEM },
            { match_time: 31, attacker_team: OURS, victim_team: THEM },
          ],
          ults: [],
          charged: [],
        },
      ],
      1,
    )
    expect(out.totalFights).toBe(0)
    expect(out.totalMaps).toBe(1)
  })
})

function fa(over: Partial<FightAdvantage>): FightAdvantage {
  return { mapDataId: 1, fightNumber: 1, start: 0, ourBank: 0, enemyBank: 0, advantage: 0, won: false, ...over }
}
