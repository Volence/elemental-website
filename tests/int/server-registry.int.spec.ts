import { describe, it, expect } from 'vitest'
import { pickGuildId, ServerResolutionError } from '@/discord/serverRegistry'

const servers = [
  { id: 1, guildId: 'PRIMARY_GUILD', active: true, isPrimary: true },
  { id: 2, guildId: 'SA_GUILD', active: true, isPrimary: false },
  { id: 3, guildId: 'OLD_GUILD', active: false, isPrimary: false },
]
const botGuildIds = new Set(['PRIMARY_GUILD', 'SA_GUILD'])

describe('pickGuildId', () => {
  it('returns the primary env guild when no serverId is given', () => {
    expect(pickGuildId({ serverId: null, servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toBe('PRIMARY_GUILD')
  })

  it('returns a registered active server the bot is in', () => {
    expect(pickGuildId({ serverId: '2', servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toBe('SA_GUILD')
  })

  it('throws for an unknown server id', () => {
    expect(() => pickGuildId({ serverId: '999', servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toThrow(ServerResolutionError)
  })

  it('throws for an inactive server', () => {
    expect(() => pickGuildId({ serverId: '3', servers, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toThrow(/inactive/i)
  })

  it('throws when the bot is not a member of the target guild', () => {
    const s = [{ id: 4, guildId: 'GHOST_GUILD', active: true, isPrimary: false }]
    expect(() => pickGuildId({ serverId: '4', servers: s, primaryEnvGuildId: 'PRIMARY_GUILD', botGuildIds })).toThrow(/not a member/i)
  })

  it('throws when no serverId and no primary env configured', () => {
    expect(() => pickGuildId({ serverId: null, servers, primaryEnvGuildId: undefined, botGuildIds })).toThrow(/primary/i)
  })
})
