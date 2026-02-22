/**
 * Auth baseline tests for API routes.
 *
 * Phase 1: Establish which routes are currently accessible without auth.
 * Phase 2: After adding auth, verify unauthenticated requests return 401.
 */

import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

// ── Routes that should become protected (Tier 2) ──

// create-admin is special: self-guards (only works when no users exist)
// No auth needed since it returns 400 when users already exist
const SELF_GUARDED_ROUTES = [
  { method: 'POST', path: '/api/create-admin' },
]

// Routes already returning 403 (have some form of auth)
const ALREADY_PROTECTED_ROUTES = [
  { method: 'POST', path: '/api/seed-teams' },
  { method: 'POST', path: '/api/ignore-duplicate' },
  { method: 'POST', path: '/api/discord/team-cards/refresh-all' },
  { method: 'GET', path: '/api/check-data-consistency' },
  { method: 'GET', path: '/api/check-people-names' },
]

// Routes newly protected with requireAuth (Tier 2)
const NEWLY_PROTECTED_ROUTES = [
  { method: 'GET', path: '/api/init-globals' },
  { method: 'POST', path: '/api/backfill-person-ids' },
  { method: 'GET', path: '/api/discord/guilds' },
  { method: 'GET', path: '/api/data-consistency-check' },
]

// ── Routes that should stay public ──

const PUBLIC_ROUTES = [
  { method: 'GET', path: '/api/health' },
]

describe('Auth — self-guarded routes', () => {
  for (const route of SELF_GUARDED_ROUTES) {
    it(`${route.method} ${route.path} — returns 400 (users already exist)`, async () => {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      // Self-guards by checking if users exist
      expect(res.status).toBe(400)
    })
  }
})

describe('Auth — newly protected routes (Tier 2)', () => {
  for (const route of NEWLY_PROTECTED_ROUTES) {
    it(`${route.method} ${route.path} — returns 401 without auth`, async () => {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        ...(route.method === 'POST' ? { body: JSON.stringify({}) } : {}),
      })
      expect(res.status).toBe(401)
    })
  }
})

describe('Auth — already protected routes', () => {
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
