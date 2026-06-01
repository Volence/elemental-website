import { describe, it, expect } from 'vitest'
import {
  analyzeFightOutcome,
  processFightStats,
  type FightEvent,
  type FightStatsMapInput,
} from '../../src/lib/scrim-parser/fight-stats'

/**
 * Fight-stats models each teamfight's outcome from our team's perspective and
 * rolls the outcomes up into ult-aware aggregates: dry fights (no ult spent),
 * reversals (won after being down 2+), wasted ults (spent while down 3+), and
 * first-pick / first-death / first-ult win rates.
 *
 * Adapted from parsertime (MIT). analyzeFightOutcome is ported with its
 * behavior intact; processFightStats replaces parsertime's Effect-framework
 * orchestration (processTeamFightStats + caching/metrics) with a plain per-map
 * adapter, and adds avgFightDuration (which the existing UI needs).
 */

const OURS = 'Us'
const THEM = 'Them'

function kill(match_time: number, attacker_team: string, victim_team: string): FightEvent {
  return { match_time, attacker_team, victim_team, event_type: 'kill' }
}
function rez(match_time: number, attacker_team: string, victim_team: string): FightEvent {
  return { match_time, attacker_team, victim_team, event_type: 'mercy_rez' }
}
function ult(match_time: number, attacker_team: string): FightEvent {
  return { match_time, attacker_team, victim_team: '', event_type: 'ultimate_start' }
}

describe('analyzeFightOutcome', () => {
  it('wins when we get more kills than the enemy', () => {
    const a = analyzeFightOutcome([kill(1, OURS, THEM), kill(2, OURS, THEM), kill(3, THEM, OURS)], OURS)
    expect(a.won).toBe(true)
  })

  it('counts a tie as a loss', () => {
    const a = analyzeFightOutcome([kill(1, OURS, THEM), kill(2, THEM, OURS)], OURS)
    expect(a.won).toBe(false)
  })

  it('marks first pick when the first kill is ours', () => {
    const a = analyzeFightOutcome([kill(1, OURS, THEM), kill(2, THEM, OURS)], OURS)
    expect(a.hadFirstPick).toBe(true)
    expect(a.hadFirstDeath).toBe(false)
  })

  it('marks first death when the first kill is against us', () => {
    const a = analyzeFightOutcome([kill(1, THEM, OURS), kill(2, OURS, THEM)], OURS)
    expect(a.hadFirstPick).toBe(false)
    expect(a.hadFirstDeath).toBe(true)
  })

  it('ignores a leading resurrect when deciding first pick/death', () => {
    // A rez fires first, then the enemy gets the first actual kill on us.
    const a = analyzeFightOutcome([rez(1, OURS, OURS), kill(2, THEM, OURS)], OURS)
    expect(a.hadFirstDeath).toBe(true)
    expect(a.hadFirstPick).toBe(false)
  })

  it('a resurrect undoes a kill against the resurrected team', () => {
    // Enemy gets 2 picks, we get 1, then one of ours is rez'd: net 1-1 -> loss.
    const a = analyzeFightOutcome(
      [kill(1, THEM, OURS), kill(2, THEM, OURS), kill(3, OURS, THEM), rez(4, OURS, OURS)],
      OURS,
    )
    expect(a.won).toBe(false)
  })

  it('is a dry fight when we spend no ults', () => {
    const a = analyzeFightOutcome([kill(1, OURS, THEM), kill(2, OURS, THEM)], OURS)
    expect(a.isDryFight).toBe(true)
    expect(a.ultCount).toBe(0)
  })

  it('counts only our ults toward ultCount', () => {
    const a = analyzeFightOutcome([ult(1, OURS), ult(2, THEM), kill(3, OURS, THEM)], OURS)
    expect(a.isDryFight).toBe(false)
    expect(a.ultCount).toBe(1)
  })

  it('marks usedFirstUlt when the earliest ult in the fight is ours', () => {
    const a = analyzeFightOutcome([kill(1, THEM, OURS), ult(2, OURS), ult(3, THEM)], OURS)
    expect(a.usedFirstUlt).toBe(true)
  })

  it('is a reversal when we win after being down 2 or more', () => {
    // Enemy goes up 2-0, we win 3-2, no ults -> dry-fight reversal.
    const a = analyzeFightOutcome(
      [kill(1, THEM, OURS), kill(2, THEM, OURS), kill(3, OURS, THEM), kill(4, OURS, THEM), kill(5, OURS, THEM)],
      OURS,
    )
    expect(a.won).toBe(true)
    expect(a.isReversal).toBe(true)
    expect(a.isDryFight).toBe(true)
  })

  it('counts a wasted ult when we ult while down 3 or more', () => {
    // Enemy 3-0, then we ult while down 3 -> wasted.
    const a = analyzeFightOutcome(
      [kill(1, THEM, OURS), kill(2, THEM, OURS), kill(3, THEM, OURS), ult(4, OURS)],
      OURS,
    )
    expect(a.wastedUlts).toBe(1)
    expect(a.ultCount).toBe(1)
  })

  it('does not count an ult as wasted when we are only down 2', () => {
    const a = analyzeFightOutcome([kill(1, THEM, OURS), kill(2, THEM, OURS), ult(3, OURS)], OURS)
    expect(a.wastedUlts).toBe(0)
  })
})

describe('processFightStats', () => {
  it('returns an empty analysis (preserving totalMaps) for no maps', () => {
    const a = processFightStats([], 3)
    expect(a.totalFights).toBe(0)
    expect(a.totalMaps).toBe(3)
    expect(a.overallWinrate).toBe(0)
  })

  it('skips maps with no kills, rezzes, or ults', () => {
    const a = processFightStats(
      [{ mapDataId: 1, ourTeamName: OURS, kills: [], rezzes: [], ults: [] }],
      1,
    )
    expect(a.totalFights).toBe(0)
  })

  it('segments events into fights on a >15s gap and does not skip single-kill fights', () => {
    const map: FightStatsMapInput = {
      mapDataId: 1,
      ourTeamName: OURS,
      kills: [
        { match_time: 10, attacker_team: OURS, victim_team: THEM },
        { match_time: 12, attacker_team: OURS, victim_team: THEM }, // same fight (+2s)
        { match_time: 40, attacker_team: THEM, victim_team: OURS }, // new fight (+28s), single kill
      ],
      rezzes: [],
      ults: [],
    }
    const a = processFightStats([map], 1)
    expect(a.totalFights).toBe(2)
    expect(a.fightsWon).toBe(1) // fight 1: 2-0 ours; fight 2: 0-1 ours
    expect(a.fightsLost).toBe(1)
  })

  it('averages fight duration as last-event minus first-event time', () => {
    const map: FightStatsMapInput = {
      mapDataId: 1,
      ourTeamName: OURS,
      kills: [
        { match_time: 10, attacker_team: OURS, victim_team: THEM },
        { match_time: 14, attacker_team: OURS, victim_team: THEM }, // fight 1 duration 4
        { match_time: 40, attacker_team: OURS, victim_team: THEM }, // fight 2 duration 0
      ],
      rezzes: [],
      ults: [],
    }
    const a = processFightStats([map], 1)
    expect(a.avgFightDuration).toBeCloseTo(2, 5) // (4 + 0) / 2
  })

  it('aggregates dry fights, reversals, ult efficiency, and first-ult win rate', () => {
    const map: FightStatsMapInput = {
      mapDataId: 1,
      ourTeamName: OURS,
      // Fight A (t 10-13): enemy up 2-0 then we win 3-2 with one ult -> non-dry reversal, won, firstUlt ours.
      // Fight B (t 100): single enemy kill, no ult -> dry fight, lost.
      kills: [
        { match_time: 10, attacker_team: THEM, victim_team: OURS },
        { match_time: 11, attacker_team: THEM, victim_team: OURS },
        { match_time: 12, attacker_team: OURS, victim_team: THEM },
        { match_time: 13, attacker_team: OURS, victim_team: THEM },
        { match_time: 14, attacker_team: OURS, victim_team: THEM },
        { match_time: 100, attacker_team: THEM, victim_team: OURS },
      ],
      rezzes: [],
      ults: [{ match_time: 9, player_team: OURS }],
    }
    const a = processFightStats([map], 1)
    expect(a.totalFights).toBe(2)
    expect(a.fightsWon).toBe(1)
    expect(a.dryFights).toBe(1)
    expect(a.nonDryFights).toBe(1)
    expect(a.nonDryFightReversals).toBe(1)
    expect(a.firstUltFights).toBe(1)
    expect(a.firstUltWins).toBe(1)
    expect(a.totalUltsUsed).toBe(1)
    expect(a.ultimateEfficiency).toBeCloseTo(1, 5) // fightsWon / totalUltsUsed = 1/1
    expect(a.avgUltsInWonFights).toBeCloseTo(1, 5)
    expect(a.avgUltsInLostFights).toBeCloseTo(0, 5)
  })
})
