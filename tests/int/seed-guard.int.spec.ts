import { describe, it, expect } from 'vitest'
import { canRunSeed } from '@/utilities/seedGuard'

const admin = { id: 1, role: 'admin' } as any
const player = { id: 2, role: 'player' } as any
const staffManager = { id: 3, role: 'staff-manager' } as any

describe('canRunSeed', () => {
  it('rejects unauthenticated requests with 403', () => {
    const result = canRunSeed(null, { NODE_ENV: 'development' })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
  })

  it('rejects any non-admin user, including staff-manager, with 403', () => {
    expect(canRunSeed(player, { NODE_ENV: 'development' })).toMatchObject({ ok: false, status: 403 })
    expect(canRunSeed(staffManager, { NODE_ENV: 'development' })).toMatchObject({ ok: false, status: 403 })
  })

  it('allows admins outside production', () => {
    expect(canRunSeed(admin, { NODE_ENV: 'development' })).toEqual({ ok: true })
    expect(canRunSeed(admin, { NODE_ENV: 'test' })).toEqual({ ok: true })
  })

  it('refuses even admins in production unless ALLOW_DB_SEED=true', () => {
    const blocked = canRunSeed(admin, { NODE_ENV: 'production' })
    expect(blocked.ok).toBe(false)
    expect(blocked.status).toBe(404)

    expect(canRunSeed(admin, { NODE_ENV: 'production', ALLOW_DB_SEED: 'true' })).toEqual({ ok: true })
  })

  it('checks the production guard before the role guard so prod never reveals the route', () => {
    expect(canRunSeed(player, { NODE_ENV: 'production' })).toMatchObject({ ok: false, status: 404 })
  })
})
