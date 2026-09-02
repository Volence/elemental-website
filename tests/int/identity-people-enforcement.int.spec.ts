import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { APIError } from 'payload'
import { enforceDiscordIdOnCreate, createAccessAllowsData } from '@/collections/People/hooks/enforceDiscordId'

const many = async () => 500
const none = async () => 0

describe('enforceDiscordIdOnCreate', () => {
  beforeEach(() => { process.env.IDENTITY_REQUIRE_DISCORD_ID = 'true' })
  afterEach(() => { delete process.env.IDENTITY_REQUIRE_DISCORD_ID })

  it('rejects a create with no discordId', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X' }, countPeople: many })).rejects.toThrow(/Discord ID/)
  })
  it('rejects a malformed discordId as a 400 APIError', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', discordId: '12' }, countPeople: many })).rejects.toThrow(/17-19/)
    try {
      await enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', discordId: '12' }, countPeople: many })
      expect.unreachable('expected enforceDiscordIdOnCreate to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(APIError)
      expect((err as APIError).status).toBe(400)
    }
  })
  it('accepts a valid discordId', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', discordId: '111111111111111111' }, countPeople: many })).resolves.toBeUndefined()
  })
  it('ignores updates', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'update', data: { name: 'X' }, countPeople: many })).resolves.toBeUndefined()
  })
  it('allows the first admin on an empty table', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', role: 'admin', email: 'a@b.c' }, countPeople: none })).resolves.toBeUndefined()
  })
  it('does nothing when the flag is off', async () => {
    delete process.env.IDENTITY_REQUIRE_DISCORD_ID
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X' }, countPeople: many })).resolves.toBeUndefined()
  })
})

describe('createAccessAllowsData', () => {
  beforeEach(() => { process.env.IDENTITY_REQUIRE_DISCORD_ID = 'true' })
  afterEach(() => { delete process.env.IDENTITY_REQUIRE_DISCORD_ID })

  it('hides the admin Create button (no data) when the flag is on', () => {
    expect(createAccessAllowsData(undefined)).toBe(false)
    expect(createAccessAllowsData({ discordId: '111111111111111111' })).toBe(true)
  })
  it('allows everything when the flag is off', () => {
    delete process.env.IDENTITY_REQUIRE_DISCORD_ID
    expect(createAccessAllowsData(undefined)).toBe(true)
  })
})
