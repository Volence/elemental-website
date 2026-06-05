import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

describe('GET /api/pug/profile/[id]/player-detail', () => {
  it('returns PUG-scoped player analytics (all maps are PUG maps)', async () => {
    const res = await fetch(`${BASE}/api/pug/profile/623/player-detail`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.player?.personId).toBe(623)
    expect(Array.isArray(body.maps)).toBe(true)
    expect(body.maps.length).toBeGreaterThan(0)
    for (const m of body.maps) expect(m.pugLobbyId).not.toBeNull()
    expect(body).toHaveProperty('heroPool')
    expect(body).toHaveProperty('finalBlowsByMethod')
  })
})
