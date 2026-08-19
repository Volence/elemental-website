import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

describe('access review API - auth gating', () => {
  it('GET requires a session', async () => {
    const res = await fetch(`${BASE}/api/access-review`)
    expect(res.status).toBe(403)
  })

  it('PATCH requires a session', async () => {
    const res = await fetch(`${BASE}/api/access-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: 1, kind: 'role', value: 'user' }),
    })
    expect(res.status).toBe(403)
  })
})
