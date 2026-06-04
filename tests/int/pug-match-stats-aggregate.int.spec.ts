import { describe, it, expect } from 'vitest'
import { aggregatePlayerLines, deriveSummary, pairRoleMatchups } from '../../src/components/PugMatchStats/aggregate'

const row = (o: Partial<any> = {}) => ({
  player_name: 'Vex', player_team: 'Team 1', personId: 5, player_hero: 'Hazard',
  eliminations: 3, final_blows: 2, deaths: 1, offensive_assists: 1, defensive_assists: 0,
  hero_damage_dealt: 1000, healing_dealt: 0, damage_blocked: 500, ultimates_used: 1,
  hero_time_played: 120, round_number: 1, ...o,
})

describe('aggregatePlayerLines', () => {
  it('sums a player across hero rows and groups heroes', () => {
    const rows = [
      row({ player_hero: 'Hazard', eliminations: 3, deaths: 1, hero_time_played: 120 }),
      row({ player_hero: 'Mauga', eliminations: 2, deaths: 2, hero_time_played: 60 }),
    ]
    const [line] = aggregatePlayerLines(rows as any, new Map())
    expect(line.name).toBe('Vex')
    expect(line.team).toBe(1)
    expect(line.eliminations).toBe(5)
    expect(line.deaths).toBe(3)
    expect(line.heroes.map((h) => h.hero)).toEqual(['Hazard', 'Mauga']) // timePlayed desc
  })

  it('maps team string to numeric and pulls role/captain from lobby map', () => {
    const lobby = new Map([[5, { team: 2, assignedRole: 'main-support', isCaptain: true }]])
    const [line] = aggregatePlayerLines([row({ personId: 5 })] as any, lobby as any)
    expect(line.team).toBe(2) // from lobby map, overrides "Team 1" string
    expect(line.assignedRole).toBe('main-support')
    expect(line.isCaptain).toBe(true)
  })
})

describe('deriveSummary', () => {
  const players = [
    { name: 'A', team: 1, eliminations: 10, deaths: 2 },
    { name: 'B', team: 2, eliminations: 12, deaths: 9 },
  ] as any

  it('uses the last match_end for score/result and last match_time for duration', () => {
    const ends = [
      { round_number: 1, team_1_score: 1, team_2_score: 0, match_time: 120 },
      { round_number: 2, team_1_score: 1, team_2_score: 2, match_time: 300 },
    ]
    const s = deriveSummary(ends as any, players, 'Lijiang Tower', 44)
    expect(s.team1Score).toBe(1)
    expect(s.team2Score).toBe(2)
    expect(s.result).toBe('team2')
    expect(s.durationSec).toBe(300)
    expect(s.standout?.name).toBe('B') // most elims
  })

  it('breaks standout ties by fewest deaths', () => {
    const tied = [
      { name: 'A', team: 1, eliminations: 10, deaths: 5 },
      { name: 'C', team: 2, eliminations: 10, deaths: 1 },
    ] as any
    const s = deriveSummary([{ round_number: 1, team_1_score: 0, team_2_score: 0, match_time: 60 }] as any, tied, 'Nepal', 1)
    expect(s.standout?.name).toBe('C')
    expect(s.result).toBe('draw')
  })
})
