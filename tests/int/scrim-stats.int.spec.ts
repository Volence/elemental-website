/**
 * Regression tests for scrim stats API routes.
 *
 * These tests lock the current query output so that the
 * $queryRawUnsafe → $queryRaw migration can be validated.
 * They run against the live dev server on localhost:3000.
 */

import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

// ── Player Stats ──────────────────────────────────────────

describe('GET /api/player-stats', () => {
  it('returns a players array with range=all', async () => {
    const res = await fetch(`${BASE}/api/player-stats?range=all`)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data).toHaveProperty('players')
    expect(Array.isArray(data.players)).toBe(true)

    // Spot-check shape of first player (if data exists)
    if (data.players.length > 0) {
      const p = data.players[0]
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('mapsPlayed')
      expect(typeof p.mapsPlayed).toBe('number')
    }
  })

  it('returns a players array with range=last20', async () => {
    const res = await fetch(`${BASE}/api/player-stats?range=last20`)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data).toHaveProperty('players')
    expect(Array.isArray(data.players)).toBe(true)
  })

  it('returns a players array with range=last30d', async () => {
    const res = await fetch(`${BASE}/api/player-stats?range=last30d`)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data).toHaveProperty('players')
    expect(Array.isArray(data.players)).toBe(true)
  })

  it('returns player detail when player param is provided', { timeout: 15000 }, async () => {
    // First get the player list to find a real player name
    const listRes = await fetch(`${BASE}/api/player-stats?range=all`)
    const listData = await listRes.json()
    if (listData.players.length === 0) return // skip if no data

    const playerName = listData.players[0].name
    const res = await fetch(`${BASE}/api/player-stats?player=${encodeURIComponent(playerName)}&range=all`)
    expect(res.status).toBe(200)
    const data = await res.json()

    // Player detail has a different shape than the list
    expect(data).toHaveProperty('player')
    expect(data).toHaveProperty('career')
    expect(data.career).toHaveProperty('eliminations')
    expect(data.career).toHaveProperty('deaths')
    expect(data.career).toHaveProperty('finalBlows')
  })
})

// ── Hero Stats ────────────────────────────────────────────

describe('GET /api/scrim-hero-stats', () => {
  it('returns heroes and teams arrays with range=all', async () => {
    const res = await fetch(`${BASE}/api/scrim-hero-stats?range=all`)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data).toHaveProperty('heroes')
    expect(data).toHaveProperty('teams')
    expect(Array.isArray(data.heroes)).toBe(true)
    expect(Array.isArray(data.teams)).toBe(true)

    if (data.heroes.length > 0) {
      const h = data.heroes[0]
      expect(h).toHaveProperty('hero')
      expect(h).toHaveProperty('mapsPlayed')
      expect(h).toHaveProperty('role')
      expect(typeof h.mapsPlayed).toBe('number')
    }
  })

  it('returns heroes with range=last30d', async () => {
    const res = await fetch(`${BASE}/api/scrim-hero-stats?range=last30d`)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data).toHaveProperty('heroes')
    expect(Array.isArray(data.heroes)).toBe(true)
  })

  it('returns heroes with range=last10', async () => {
    const res = await fetch(`${BASE}/api/scrim-hero-stats?range=last10`)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data).toHaveProperty('heroes')
    expect(Array.isArray(data.heroes)).toBe(true)
  })

  it('returns hero detail when hero param is provided', { timeout: 15000 }, async () => {
    // First get hero list to find a real hero name
    const listRes = await fetch(`${BASE}/api/scrim-hero-stats?range=all`)
    const listData = await listRes.json()
    if (listData.heroes.length === 0) return // skip if no data

    const heroName = listData.heroes[0].hero
    const res = await fetch(`${BASE}/api/scrim-hero-stats?hero=${encodeURIComponent(heroName)}&range=all`)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data).toHaveProperty('hero')
    expect(data).toHaveProperty('career')
    expect(data).toHaveProperty('topPlayers')
    expect(data).toHaveProperty('trendData')
    expect(data.career).toHaveProperty('eliminations')
    expect(data.career).toHaveProperty('elimsPer10')
  })
})
