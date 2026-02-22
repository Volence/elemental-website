import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

describe('API', () => {
  it('health check returns 200', async () => {
    const res = await fetch(`${BASE}/api/health`)
    expect(res.status).toBe(200)
  })
})
