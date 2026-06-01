import { describe, it, expect } from 'vitest'
import { parseScrimLog } from '../../src/lib/scrim-parser/parser'
import { groupPlayersByTeam } from '../../src/lib/scrim-parser/team-assignment'

// 39-col player_stat tail borrowed from the parser fixture (values irrelevant
// to team assignment - only round/team/name columns matter here).
const TAIL = '3,2,1,1000,0,900,0,0,0,500,0,0,0,1,1,0,0,0,0,0,0,5,50,40,30,2,100,80,20,0,0,0,80,120'

function stat(time: number, round: number, team: string, name: string, hero = 'Tracer') {
  return `[00:00:0${time % 10}] ,player_stat,${time},${round},${team},${name},${hero},${TAIL}`
}

function spawn(time: number, team: string, name: string, hero = 'Tracer') {
  return `[00:00:0${time % 10}] ,hero_spawn,${time},${team},${name},${hero},None,0`
}

describe('groupPlayersByTeam', () => {
  it('keeps teams disjoint when sides swap mid-match (Control / slot reshuffle)', () => {
    // Round 1: Team 1 = A*, Team 2 = B*. Round 2: sides swap.
    const log = [
      '[00:00:00] ,match_start,0,Oasis,Control,Team 1,Team 2',
      stat(1, 1, 'Team 1', 'A1'),
      stat(1, 1, 'Team 1', 'A2'),
      stat(1, 1, 'Team 2', 'B1'),
      stat(1, 1, 'Team 2', 'B2'),
      stat(9, 2, 'Team 2', 'A1'), // swapped to Team 2
      stat(9, 2, 'Team 2', 'A2'),
      stat(9, 2, 'Team 1', 'B1'), // swapped to Team 1
      stat(9, 2, 'Team 1', 'B2'),
    ].join('\n')

    const players = groupPlayersByTeam([parseScrimLog(log)])

    // Each player must appear in exactly one team.
    const all = Object.values(players).flat()
    expect(all.sort()).toEqual(['A1', 'A2', 'B1', 'B2'])

    // Earliest appearance (round 1) wins: A* on Team 1, B* on Team 2.
    expect(players['Team 1'].sort()).toEqual(['A1', 'A2'])
    expect(players['Team 2'].sort()).toEqual(['B1', 'B2'])
  })

  it('assigns a late-joining sub to their debut side', () => {
    const log = [
      '[00:00:00] ,match_start,0,Oasis,Control,Team 1,Team 2',
      stat(1, 1, 'Team 1', 'A1'),
      stat(1, 1, 'Team 2', 'B1'),
      stat(9, 2, 'Team 2', 'Sub'), // first appears round 2 on Team 2
    ].join('\n')

    const players = groupPlayersByTeam([parseScrimLog(log)])
    expect(players['Team 2'].sort()).toEqual(['B1', 'Sub'])
    expect(players['Team 1']).toEqual(['A1'])
  })

  it('includes a hero_spawn-only player (e.g. subbed out before a snapshot)', () => {
    const log = [
      '[00:00:00] ,match_start,0,Ilios,Control,Team 1,Team 2',
      stat(1, 1, 'Team 1', 'A1'),
      stat(1, 1, 'Team 2', 'B1'),
      spawn(1, 'Team 2', 'SubbedOut'), // never records a player_stat row
    ].join('\n')

    const players = groupPlayersByTeam([parseScrimLog(log)])
    const all = Object.values(players).flat()
    expect(all).toContain('SubbedOut')
    // Falls back to their hero_spawn side; teams stay disjoint.
    expect(players['Team 2'].sort()).toEqual(['B1', 'SubbedOut'])
    expect(players['Team 1']).toEqual(['A1'])
  })

  it('never lets an unreliable hero_spawn label override a player_stat team', () => {
    // This is the scramble that caused the original "everyone on one team" bug:
    // hero_spawn reported a bogus side for a player who actually played.
    const log = [
      '[00:00:00] ,match_start,0,Oasis,Control,Team 1,Team 2',
      stat(1, 1, 'Team 1', 'A1'),
      spawn(5, 'Team 2', 'A1'), // bogus: hero_spawn says Team 2
      stat(1, 1, 'Team 2', 'B1'),
    ].join('\n')

    const players = groupPlayersByTeam([parseScrimLog(log)])
    expect(players['Team 1']).toEqual(['A1']) // stays where player_stat put them
    expect(players['Team 2']).toEqual(['B1'])
  })

  it('aggregates players across multiple map files into stable teams', () => {
    const mapA = [
      '[00:00:00] ,match_start,0,Ilios,Control,Team 1,Team 2',
      stat(1, 1, 'Team 1', 'A1'),
      stat(1, 1, 'Team 2', 'B1'),
    ].join('\n')
    const mapB = [
      '[00:00:00] ,match_start,0,Rialto,Escort,Team 1,Team 2',
      stat(1, 1, 'Team 1', 'A1'),
      stat(1, 1, 'Team 2', 'B1'),
    ].join('\n')

    const players = groupPlayersByTeam([parseScrimLog(mapA), parseScrimLog(mapB)])
    expect(players['Team 1']).toEqual(['A1'])
    expect(players['Team 2']).toEqual(['B1'])
  })

  it('reconciles teams across maps when the Team 1/Team 2 labels flip', () => {
    // Same two rosters, but the lobby is rebuilt for map B so the labels swap:
    // roster Y is "Team 1" on map A but "Team 2" on map B (and vice-versa).
    // Grouping by label would scatter each roster; co-membership keeps them whole.
    const mapA = [
      '[00:00:00] ,match_start,0,Ilios,Control,Team 1,Team 2',
      stat(1, 1, 'Team 1', 'Y1'),
      stat(1, 1, 'Team 1', 'Y2'),
      stat(1, 1, 'Team 1', 'Y3'),
      stat(1, 1, 'Team 2', 'X1'),
      stat(1, 1, 'Team 2', 'X2'),
      stat(1, 1, 'Team 2', 'X3'),
    ].join('\n')
    const mapB = [
      '[00:00:00] ,match_start,0,Rialto,Escort,Team 1,Team 2',
      stat(1, 1, 'Team 2', 'Y1'),
      stat(1, 1, 'Team 2', 'Y2'),
      stat(1, 1, 'Team 2', 'Y4'), // a sub joins roster Y on map B
      stat(1, 1, 'Team 1', 'X1'),
      stat(1, 1, 'Team 1', 'X2'),
      stat(1, 1, 'Team 1', 'X3'),
    ].join('\n')

    const players = groupPlayersByTeam([parseScrimLog(mapA), parseScrimLog(mapB)])
    // Roster Y stays whole under the first map's "Team 1" label; X under "Team 2".
    expect(players['Team 1'].sort()).toEqual(['Y1', 'Y2', 'Y3', 'Y4'])
    expect(players['Team 2'].sort()).toEqual(['X1', 'X2', 'X3'])
  })
})
