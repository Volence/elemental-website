import { describe, it, expect, vi } from 'vitest'
import { resolveDiscordLogin, resolveDiscordLink, type LoginDeps, type LinkDeps } from '@/identity/discordLogin'

const profile = { id: '111111111111111111', username: 'volence', displayName: 'Volence', avatar: 'abc' }
const person = { id: 7, name: 'Volence', email: null, discordId: profile.id, role: 'user', isInactive: false }

function loginDeps(over: Partial<LoginDeps> = {}): LoginDeps {
  return {
    isMember: async () => true,
    findByDiscordId: async () => null,
    createFromDiscord: async () => person,
    refreshProfile: async () => {},
    findClaimCandidates: async () => [],
    ...over,
  }
}

describe('resolveDiscordLogin', () => {
  it('denies non-members and creates nothing', async () => {
    const create = vi.fn()
    const out = await resolveDiscordLogin(loginDeps({ isMember: async () => false, createFromDiscord: create }), profile)
    expect(out).toEqual({ kind: 'not_member' })
    expect(create).not.toHaveBeenCalled()
  })
  it('fails closed when membership cannot be checked', async () => {
    const out = await resolveDiscordLogin(loginDeps({ isMember: async () => null }), profile)
    expect(out).toEqual({ kind: 'membership_unknown' })
  })
  it('logs a known Discord ID in and refreshes the profile', async () => {
    const refresh = vi.fn(async () => {})
    const out = await resolveDiscordLogin(loginDeps({ findByDiscordId: async () => person, refreshProfile: refresh }), profile)
    expect(out).toEqual({ kind: 'login', person })
    expect(refresh).toHaveBeenCalledWith(7, profile)
  })
  it('creates a row for an unknown member and returns claim candidates', async () => {
    const candidates = [{ id: 3, name: 'Volence', teams: ['Bug'], score: 1 }]
    const out = await resolveDiscordLogin(loginDeps({ findClaimCandidates: async () => candidates }), profile)
    expect(out).toEqual({ kind: 'created', person, candidates })
  })
  it('creates a row with no candidates when nothing matches', async () => {
    const out = await resolveDiscordLogin(loginDeps(), profile)
    expect(out.kind).toBe('created')
    expect((out as any).candidates).toEqual([])
  })
})

function linkDeps(over: Partial<LinkDeps> = {}): LinkDeps {
  return {
    findByDiscordId: async () => null,
    hasReferences: async () => false,
    setIdentity: async () => {},
    clearDiscordId: async () => {},
    markInactive: async () => {},
    ...over,
  }
}

describe('resolveDiscordLink', () => {
  it('links when the Discord ID is unused', async () => {
    const set = vi.fn(async () => {})
    expect(await resolveDiscordLink(linkDeps({ setIdentity: set }), 5, profile)).toEqual({ kind: 'linked' })
    expect(set).toHaveBeenCalledWith(5, profile)
  })
  it('is a no-op when the ID is already on the current person', async () => {
    const out = await resolveDiscordLink(linkDeps({ findByDiscordId: async () => ({ ...person, id: 5 }) }), 5, profile)
    expect(out).toEqual({ kind: 'already_linked_here' })
  })
  it('absorbs a stray self-signup row: no password, no references', async () => {
    const stray = { ...person, id: 9, hash: null }
    const clear = vi.fn(async () => {}), inactive = vi.fn(async () => {}), set = vi.fn(async () => {})
    const out = await resolveDiscordLink(linkDeps({ findByDiscordId: async () => stray, clearDiscordId: clear, markInactive: inactive, setIdentity: set }), 5, profile)
    expect(out).toEqual({ kind: 'linked' })
    expect(clear).toHaveBeenCalledWith(9)
    expect(inactive).toHaveBeenCalledWith(9, 5)
    expect(set).toHaveBeenCalledWith(5, profile)
  })
  it('refuses when the other row has a password', async () => {
    const other = { ...person, id: 9, hash: 'x' }
    expect(await resolveDiscordLink(linkDeps({ findByDiscordId: async () => other }), 5, profile)).toEqual({ kind: 'conflict', otherId: 9 })
  })
  it('refuses when the other row has team or staff references', async () => {
    const other = { ...person, id: 9, hash: null }
    expect(await resolveDiscordLink(linkDeps({ findByDiscordId: async () => other, hasReferences: async () => true }), 5, profile)).toEqual({ kind: 'conflict', otherId: 9 })
  })
})
