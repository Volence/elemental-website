import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { enforceDiscordIdOnCreate, createAccessAllowsData } from '@/collections/People/hooks/enforceDiscordId'

const many = async () => 500
const none = async () => 0

describe('enforceDiscordIdOnCreate', () => {
  beforeEach(() => { process.env.IDENTITY_REQUIRE_DISCORD_ID = 'true' })
  afterEach(() => { delete process.env.IDENTITY_REQUIRE_DISCORD_ID })

  it('rejects a create with no discordId', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X' }, countPeople: many })).rejects.toThrow(/Discord ID/)
  })
  it('rejects a malformed discordId', async () => {
    await expect(enforceDiscordIdOnCreate({ operation: 'create', data: { name: 'X', discordId: '12' }, countPeople: many })).rejects.toThrow(/17-19/)
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
  it('hides the admin Create button (no data) when the flag is on', () => {
    process.env.IDENTITY_REQUIRE_DISCORD_ID = 'true'
    expect(createAccessAllowsData(undefined)).toBe(false)
    expect(createAccessAllowsData({ discordId: '111111111111111111' })).toBe(true)
    delete process.env.IDENTITY_REQUIRE_DISCORD_ID
  })
  it('allows everything when the flag is off', () => {
    expect(createAccessAllowsData(undefined)).toBe(true)
  })
})
