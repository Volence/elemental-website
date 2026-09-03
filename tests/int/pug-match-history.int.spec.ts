import { describe, it, expect } from 'vitest'
import { buildMatchRows, deriveResult, parseStatusFilter, type LobbyLike } from '@/pug/matchHistory'

const lobby = (over: Partial<LobbyLike> = {}): LobbyLike => ({
  id: 10,
  lobbyNumber: 42,
  tier: 'open',
  region: 'na',
  status: 'COMPLETED',
  payloadSeasonId: 3,
  completedAt: new Date('2026-09-01T20:00:00Z'),
  updatedAt: new Date('2026-09-01T20:05:00Z'),
  pendingResult: { result: 'team2' },
  ratingChanges: { 1: 12, 2: -12 },
  players: [
    { userId: 1, team: 1, assignedRole: 'tank', isCaptain: false },
    { userId: 2, team: 2, assignedRole: 'main_support', isCaptain: true },
    { userId: 3, team: 1, assignedRole: 'flex_dps', isCaptain: true },
    { userId: 4, team: null, assignedRole: null, isCaptain: false },
  ],
  mapVote: { selectedMapId: 7 },
  ...over,
})

describe('deriveResult', () => {
  it('reads the stored result for completed lobbies', () => {
    expect(deriveResult('COMPLETED', { result: 'team1' })).toBe('team1')
    expect(deriveResult('COMPLETED', { result: 'draw' })).toBe('draw')
  })
  it('is cancelled for cancelled lobbies whatever was stored', () => {
    expect(deriveResult('CANCELLED', { result: 'team1' })).toBe('cancelled')
  })
  it('is pending when nothing usable is stored', () => {
    expect(deriveResult('DISPUTED', null)).toBe('pending')
    expect(deriveResult('COMPLETED', { result: 'nonsense' })).toBe('pending')
    expect(deriveResult('COMPLETED', 'garbage')).toBe('pending')
  })
})

describe('parseStatusFilter', () => {
  it('defaults to every finished status', () => {
    expect(parseStatusFilter(null)).toEqual(['COMPLETED', 'DISPUTED', 'CANCELLED'])
    expect(parseStatusFilter('finished')).toEqual(['COMPLETED', 'DISPUTED', 'CANCELLED'])
    expect(parseStatusFilter('OPEN')).toEqual(['COMPLETED', 'DISPUTED', 'CANCELLED'])
  })
  it('narrows to one finished status, case-insensitively', () => {
    expect(parseStatusFilter('disputed')).toEqual(['DISPUTED'])
    expect(parseStatusFilter('CANCELLED')).toEqual(['CANCELLED'])
  })
})

describe('buildMatchRows', () => {
  const names = new Map([[1, 'Ana'], [2, 'Bap'], [3, 'Cass']])
  const seasons = new Map([[3, 'Season 3']])
  const maps = new Map([[7, 'Ilios']])

  it('splits players into teams, captains first, and resolves names', () => {
    const [row] = buildMatchRows([lobby()], names, seasons, maps)
    expect(row.team1.map((p) => p.name)).toEqual(['Cass', 'Ana'])
    expect(row.team1[0].isCaptain).toBe(true)
    expect(row.team2).toEqual([{ id: 2, name: 'Bap', role: 'main_support', isCaptain: true }])
    expect(row.unassigned).toBe(1)
  })

  it('resolves season and map names and derives the result', () => {
    const [row] = buildMatchRows([lobby()], names, seasons, maps)
    expect(row.seasonName).toBe('Season 3')
    expect(row.mapName).toBe('Ilios')
    expect(row.result).toBe('team2')
    expect(row.ratingChanged).toBe(true)
    expect(row.playedAt).toBe('2026-09-01T20:00:00.000Z')
  })

  it('falls back to placeholders when lookups miss', () => {
    const [row] = buildMatchRows(
      [lobby({ payloadSeasonId: 99, mapVote: null, completedAt: null, ratingChanges: null, status: 'CANCELLED' })],
      new Map(),
      seasons,
      maps,
    )
    expect(row.team1[0].name).toBe('Player #3')
    expect(row.seasonName).toBeNull()
    expect(row.mapName).toBeNull()
    expect(row.result).toBe('cancelled')
    expect(row.ratingChanged).toBe(false)
    expect(row.playedAt).toBe('2026-09-01T20:05:00.000Z')
  })
})
