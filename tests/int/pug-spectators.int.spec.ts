import { describe, it, expect } from 'vitest'
import { decideSpectatorInvite } from '../../src/pug/spectators'

describe('decideSpectatorInvite', () => {
  const INVITABLE = ['lobby_created', 'invites_sent', 'players_joining']
  const LIVE = ['game_started']
  const PENDING_AFTER = ['game_ended']
  const NOT_YET = ['preparing', 'lobby_ready', 'creating', 'error']

  for (const status of INVITABLE) {
    it(`INVITE_NOW when status=${status} and instance present`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('INVITE_NOW')
    })
    it(`KEEP_PENDING when status=${status} but no instance`, () => {
      expect(decideSpectatorInvite(status, null)).toBe('KEEP_PENDING')
    })
  }

  for (const status of LIVE) {
    it(`INVITE_NOW when status=${status} (live match) with instance`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('INVITE_NOW')
    })
    it(`KEEP_PENDING when status=${status} but no instance`, () => {
      expect(decideSpectatorInvite(status, null)).toBe('KEEP_PENDING')
    })
  }

  for (const status of PENDING_AFTER) {
    it(`KEEP_PENDING when status=${status}`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('KEEP_PENDING')
    })
  }

  for (const status of NOT_YET) {
    it(`KEEP_PENDING when status=${status}`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('KEEP_PENDING')
    })
  }

  it('KEEP_PENDING when status is null', () => {
    expect(decideSpectatorInvite(null, 'inst-1')).toBe('KEEP_PENDING')
  })
})

const BASE = 'http://localhost:3000'
const h = { 'Content-Type': 'application/json' }

describe('Spectators API - auth gating', () => {
  it('POST /api/pug/lobby/1/spectators - 401 without auth', async () => {
    const res = await fetch(`${BASE}/api/pug/lobby/1/spectators`, {
      method: 'POST', headers: h, body: JSON.stringify({ battleTag: 'Test#1234' }),
    })
    expect(res.status).toBe(401)
  })
  it('DELETE /api/pug/lobby/1/spectators - 401 without auth', async () => {
    const res = await fetch(`${BASE}/api/pug/lobby/1/spectators`, {
      method: 'DELETE', headers: h, body: JSON.stringify({ battleTag: 'Test#1234' }),
    })
    expect(res.status).toBe(401)
  })
})
