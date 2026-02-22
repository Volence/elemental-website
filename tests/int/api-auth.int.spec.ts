/**
 * Auth baseline tests for API routes.
 *
 * Phase 1: Establish which routes are currently accessible without auth.
 * Phase 2: After adding auth, verify unauthenticated requests return 401.
 */

import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

// ── Routes that should become protected (Tier 2) ──

const ROUTES_TO_PROTECT = [
  // Critical — destructive / admin-only
  { method: 'POST', path: '/api/create-admin' },
  { method: 'POST', path: '/api/init-globals' },

  // Medium — data modification
  { method: 'POST', path: '/api/backfill-person-ids' },

  // Discord admin routes
  { method: 'GET', path: '/api/discord/guilds' },

  // Debug / data routes
  { method: 'GET', path: '/api/data-consistency-check' },
]

// Routes already returning 403 (have some form of auth)
const ALREADY_PROTECTED_ROUTES = [
  { method: 'POST', path: '/api/seed-teams' },
  { method: 'POST', path: '/api/ignore-duplicate' },
  { method: 'POST', path: '/api/discord/team-cards/refresh-all' },
  { method: 'GET', path: '/api/check-data-consistency' },
  { method: 'GET', path: '/api/check-people-names' },
]

// ── Routes that should stay public ──

const PUBLIC_ROUTES = [
  { method: 'GET', path: '/api/health' },
]

describe('Auth baseline — routes to protect', () => {
  // PRE-CHANGE: These routes currently respond without auth.
  // After Tier 2 changes, update these tests to expect 401.
  for (const route of ROUTES_TO_PROTECT) {
    it(`${route.method} ${route.path} — currently accessible (will be protected)`, async () => {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        // POST routes may need a body to avoid 400 — send empty object
        ...(route.method === 'POST' ? { body: JSON.stringify({}) } : {}),
      })
      // We just confirm the route exists and doesn't 404.
      // Some may return 400 (bad input) or 500, but NOT 401/403 (since no auth).
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(403)
    })
  }
})

describe('Auth baseline — already protected routes', () => {
  for (const route of ALREADY_PROTECTED_ROUTES) {
    it(`${route.method} ${route.path} — already returns 401/403`, async () => {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        ...(route.method === 'POST' ? { body: JSON.stringify({}) } : {}),
      })
      expect([401, 403]).toContain(res.status)
    })
  }
})

describe('Auth baseline — public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    it(`${route.method} ${route.path} — should stay public`, async () => {
      const res = await fetch(`${BASE}${route.path}`, { method: route.method })
      expect(res.status).toBe(200)
    })
  }
})
