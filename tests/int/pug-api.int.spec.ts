import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'
const h = { 'Content-Type': 'application/json' }

const PUG_PROTECTED_ROUTES = [
  { method: 'GET', path: '/api/pug/lobby' },
  { method: 'POST', path: '/api/pug/register' },
  { method: 'POST', path: '/api/pug/invite/register' },
  { method: 'POST', path: '/api/pug/lobby' },
  { method: 'GET', path: '/api/pug/lobby/1' },
  { method: 'POST', path: '/api/pug/lobby/1/queue' },
  { method: 'DELETE', path: '/api/pug/lobby/1/queue' },
  { method: 'POST', path: '/api/pug/lobby/1/draft/pick' },
  { method: 'POST', path: '/api/pug/lobby/1/map-vote' },
  { method: 'POST', path: '/api/pug/lobby/1/ban' },
  { method: 'POST', path: '/api/pug/lobby/1/report' },
  { method: 'POST', path: '/api/pug/lobby/1/confirm' },
]

describe('PUG API — auth gating', () => {
  for (const route of PUG_PROTECTED_ROUTES) {
    it(`${route.method} ${route.path} — returns 401 without auth`, async () => {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: h,
        ...(route.method === 'POST' ? { body: JSON.stringify({}) } : {}),
      })
      expect(res.status).toBe(401)
    })
  }
})

describe('PUG API — public leaderboard', () => {
  it('GET /api/pug/leaderboard — returns 401 without auth', async () => {
    const res = await fetch(`${BASE}/api/pug/leaderboard`)
    expect(res.status).toBe(401)
  })
})
