import type { PugRegion } from '@/pug/types'
/**
 * Pure helpers for the PUG Players table: filtering, rating join, sorting.
 * Kept free of React and fetch so they are unit testable.
 */

export interface PugPlayerRow {
  id: number
  name?: string | null
  email?: string | null
  pugBattleTag?: string | null
  pugTiers?: string[] | null
  pugApprovedRoles?: string[] | null
  pugInviteRegions?: string[] | null
  pugRegisteredDate?: string | null
  pugActiveBan?: { bannedUntil?: string | null; reason?: string | null } | null
  pugBanOffenseCount?: number | null
  discordId?: string | null
}

export interface LeaderboardRow {
  player?: number | { id: number } | null
  season?: number | { id: number } | null
  tier?: string | null
  rating?: number | null
  gamesPlayed?: number | null
  wins?: number | null
  losses?: number | null
  draws?: number | null
}

export interface RatingSummary {
  rating: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  tier: string | null
}

export interface PlayerFilters {
  search: string
  tier: 'all' | 'open' | 'invite'
  region: 'all' | PugRegion
  status: 'all' | 'banned' | 'unlinked'
}

export const DEFAULT_PLAYER_FILTERS: PlayerFilters = { search: '', tier: 'all', region: 'all', status: 'all' }

export function isBanned(ban: PugPlayerRow['pugActiveBan'], now: number = Date.now()): boolean {
  if (!ban?.bannedUntil) return false
  const until = Date.parse(ban.bannedUntil)
  return Number.isFinite(until) && until > now
}

function relId(ref: number | { id: number } | null | undefined): number | null {
  if (typeof ref === 'number') return ref
  if (ref && typeof ref === 'object' && typeof ref.id === 'number') return ref.id
  return null
}

/**
 * Best rating per player across the given leaderboard rows (normally one active
 * season per tier). When a player has both an open and an invite entry, the
 * entry with more games wins, so the number shown reflects where they play.
 */
export function joinRatings(rows: LeaderboardRow[]): Map<number, RatingSummary> {
  const out = new Map<number, RatingSummary>()
  for (const row of rows) {
    const playerId = relId(row.player)
    if (playerId === null) continue
    const games = row.gamesPlayed ?? 0
    const current = out.get(playerId)
    if (current && current.gamesPlayed >= games) continue
    out.set(playerId, {
      rating: Math.round(row.rating ?? 1500),
      gamesPlayed: games,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      draws: row.draws ?? 0,
      tier: row.tier ?? null,
    })
  }
  return out
}

export function filterPlayers(players: PugPlayerRow[], filters: PlayerFilters, now: number = Date.now()): PugPlayerRow[] {
  const q = filters.search.trim().toLowerCase()
  return players.filter((p) => {
    if (filters.tier !== 'all' && !(p.pugTiers ?? []).includes(filters.tier)) return false
    if (filters.region !== 'all' && !(p.pugInviteRegions ?? []).includes(filters.region)) return false
    if (filters.status === 'banned' && !isBanned(p.pugActiveBan, now)) return false
    if (filters.status === 'unlinked' && p.discordId) return false
    if (q) {
      const hay = [p.name, p.email, p.pugBattleTag].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export type PlayerSortKey = 'name' | 'rating' | 'games' | 'registered'

export function sortPlayers(
  players: PugPlayerRow[],
  ratings: Map<number, RatingSummary>,
  key: PlayerSortKey,
  direction: 'asc' | 'desc',
): PugPlayerRow[] {
  const dir = direction === 'asc' ? 1 : -1
  const val = (p: PugPlayerRow): string | number => {
    switch (key) {
      case 'name':
        return (p.name ?? p.email ?? '').toLowerCase()
      case 'rating':
        return ratings.get(p.id)?.rating ?? -1
      case 'games':
        return ratings.get(p.id)?.gamesPlayed ?? -1
      case 'registered':
        return p.pugRegisteredDate ? Date.parse(p.pugRegisteredDate) : 0
    }
  }
  return [...players].sort((a, b) => {
    const av = val(a)
    const bv = val(b)
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
}
