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

  it('accumulates the same hero across rounds (one row per player+hero+round)', () => {
    const rows = [
      row({ player_hero: 'Hazard', round_number: 1, eliminations: 4, hero_time_played: 120 }),
      row({ player_hero: 'Hazard', round_number: 2, eliminations: 3, hero_time_played: 80 }),
    ]
    const [line] = aggregatePlayerLines(rows as any, new Map())
    expect(line.heroes).toHaveLength(1)
    expect(line.heroes[0].hero).toBe('Hazard')
    expect(line.heroes[0].timePlayedSec).toBe(200)
    expect(line.heroes[0].eliminations).toBe(7)
    expect(line.eliminations).toBe(7)
  })

  it('keeps same-named guests on opposite teams separate when unlinked', () => {
    const rows = [
      row({ personId: null, player_name: 'Smurf', player_team: 'Team 1', eliminations: 5 }),
      row({ personId: null, player_name: 'Smurf', player_team: 'Team 2', eliminations: 2 }),
    ]
    const lines = aggregatePlayerLines(rows as any, new Map())
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.team).sort()).toEqual([1, 2])
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

const pl = (name: string, team: number, role: string | null) =>
  ({ name, team, assignedRole: role, eliminations: 0, deaths: 0 } as any)

describe('pairRoleMatchups', () => {
  it('pairs one team1 + one team2 player per role; leftovers go unpaired', () => {
    const players = [
      pl('A', 1, 'tank'), pl('B', 2, 'tank'),
      pl('C', 1, 'main-support'), pl('D', 2, 'main-support'),
      pl('E', 1, null), // no role -> unpaired
    ]
    const { matchups, unpaired } = pairRoleMatchups(players)
    const tank = matchups.find((m) => m.role === 'tank')!
    expect(tank.team1?.name).toBe('A')
    expect(tank.team2?.name).toBe('B')
    expect(unpaired.map((p) => p.name)).toEqual(['E'])
  })

  it('keeps a half-filled role as a matchup with one null side', () => {
    const players = [pl('A', 1, 'tank'), pl('B', 2, 'main-support')]
    const { matchups, unpaired } = pairRoleMatchups(players)
    expect(matchups.find((m) => m.role === 'tank')?.team2).toBeNull()
    expect(matchups.find((m) => m.role === 'main-support')?.team1).toBeNull()
    expect(unpaired).toEqual([])
  })
})
