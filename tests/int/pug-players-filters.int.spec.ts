import { describe, it, expect } from 'vitest'
import { filterPlayers, joinRatings, sortPlayers, isBanned, DEFAULT_PLAYER_FILTERS } from '@/components/PugPlayers/filters'

const NOW = Date.parse('2026-09-03T00:00:00.000Z')

const players = [
  { id: 1, name: 'Alpha', pugBattleTag: 'Alpha#1234', pugTiers: ['open'], pugInviteRegions: [], discordId: 'd1' },
  { id: 2, name: 'Bravo', pugTiers: ['open', 'invite'], pugInviteRegions: ['na'], discordId: 'd2', pugActiveBan: { bannedUntil: '2026-12-01T00:00:00.000Z' } },
  { id: 3, name: 'Charlie', email: 'c@example.com', pugTiers: ['invite'], pugInviteRegions: ['emea'], discordId: null, pugActiveBan: { bannedUntil: '2026-01-01T00:00:00.000Z' } },
]

describe('isBanned', () => {
  it('is true only for a future bannedUntil', () => {
    expect(isBanned({ bannedUntil: '2026-12-01T00:00:00.000Z' }, NOW)).toBe(true)
    expect(isBanned({ bannedUntil: '2026-01-01T00:00:00.000Z' }, NOW)).toBe(false)
    expect(isBanned(null, NOW)).toBe(false)
    expect(isBanned({ bannedUntil: 'garbage' }, NOW)).toBe(false)
  })
})

describe('filterPlayers', () => {
  it('returns everyone with default filters', () => {
    expect(filterPlayers(players, DEFAULT_PLAYER_FILTERS, NOW).map((p) => p.id)).toEqual([1, 2, 3])
  })
  it('filters by tier, region and status', () => {
    expect(filterPlayers(players, { ...DEFAULT_PLAYER_FILTERS, tier: 'invite' }, NOW).map((p) => p.id)).toEqual([2, 3])
    expect(filterPlayers(players, { ...DEFAULT_PLAYER_FILTERS, region: 'emea' }, NOW).map((p) => p.id)).toEqual([3])
    expect(filterPlayers(players, { ...DEFAULT_PLAYER_FILTERS, status: 'banned' }, NOW).map((p) => p.id)).toEqual([2])
    expect(filterPlayers(players, { ...DEFAULT_PLAYER_FILTERS, status: 'unlinked' }, NOW).map((p) => p.id)).toEqual([3])
  })
  it('searches name, email and battletag case-insensitively', () => {
    expect(filterPlayers(players, { ...DEFAULT_PLAYER_FILTERS, search: 'alpha#' }, NOW).map((p) => p.id)).toEqual([1])
    expect(filterPlayers(players, { ...DEFAULT_PLAYER_FILTERS, search: 'C@EXAMPLE' }, NOW).map((p) => p.id)).toEqual([3])
    expect(filterPlayers(players, { ...DEFAULT_PLAYER_FILTERS, search: 'zzz' }, NOW)).toEqual([])
  })
})

describe('joinRatings', () => {
  it('keys by player id and prefers the entry with more games', () => {
    const map = joinRatings([
      { player: 1, tier: 'open', rating: 1601.7, gamesPlayed: 3, wins: 2, losses: 1 },
      { player: { id: 1 }, tier: 'invite', rating: 1750, gamesPlayed: 12, wins: 8, losses: 4 },
      { player: 2, tier: 'open', rating: 1500, gamesPlayed: 0 },
      { player: null, rating: 9999 },
    ])
    expect(map.get(1)).toEqual({ rating: 1750, gamesPlayed: 12, wins: 8, losses: 4, draws: 0, tier: 'invite' })
    expect(map.get(2)?.rating).toBe(1500)
    expect(map.size).toBe(2)
  })
})

describe('sortPlayers', () => {
  const ratings = joinRatings([
    { player: 1, rating: 1600, gamesPlayed: 5 },
    { player: 3, rating: 1900, gamesPlayed: 20 },
  ])
  it('sorts by rating with unrated players last in descending order', () => {
    expect(sortPlayers(players, ratings, 'rating', 'desc').map((p) => p.id)).toEqual([3, 1, 2])
  })
  it('sorts by name ascending', () => {
    expect(sortPlayers(players, ratings, 'name', 'asc').map((p) => p.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
})
