import { describe, it, expect } from 'vitest'
import { createGuildGateway, snowflakeCreatedAt, type GuildLike } from '@/identity/guild'

function fakeGuild(id: string, label: string, members: Array<{ id: string; username: string; globalName?: string; nickname?: string; avatar?: string; joinedAt?: string }>): GuildLike {
  return {
    id,
    label,
    async fetchMember(discordId) {
      const m = members.find((x) => x.id === discordId)
      if (!m) { const e: any = new Error('Unknown Member'); e.code = 10007; throw e }
      return toMember(m)
    },
    async searchMembers(query, limit) {
      const q = query.toLowerCase()
      return members.filter((m) => [m.username, m.globalName, m.nickname].some((n) => n?.toLowerCase().includes(q))).slice(0, limit).map(toMember)
    },
    async allMembers() { return members.map(toMember) },
  }
  function toMember(m: any) {
    return { id: m.id, username: m.username, globalName: m.globalName ?? null, nickname: m.nickname ?? null, avatar: m.avatar ?? null, joinedAt: m.joinedAt ?? null }
  }
}

const hub = fakeGuild('g1', 'Hub', [
  { id: '111111111111111111', username: 'volence', globalName: 'Volence', nickname: 'Vol', joinedAt: '2024-01-01T00:00:00.000Z' },
  { id: '222222222222222222', username: 'zed', globalName: 'Zed' },
])
const na = fakeGuild('g2', 'NA', [
  { id: '111111111111111111', username: 'volence', globalName: 'Volence', joinedAt: '2024-06-01T00:00:00.000Z' },
])

describe('createGuildGateway', () => {
  it('reports membership in any registered guild', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    expect(await gw.isMember('111111111111111111')).toBe(true)
    expect(await gw.isMember('333333333333333333')).toBe(false)
  })
  it('returns null when no guild can be reached', async () => {
    const gw = createGuildGateway({ guilds: async () => [] })
    expect(await gw.isMember('111111111111111111')).toBeNull()
  })
  it('returns null on a non-Unknown-Member error', async () => {
    const broken: GuildLike = { ...hub, fetchMember: async () => { throw new Error('boom') } }
    const gw = createGuildGateway({ guilds: async () => [broken] })
    expect(await gw.isMember('111111111111111111')).toBeNull()
  })
  it('merges search hits across guilds by id and lists every server', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    const hits = await gw.searchMembers('vol')
    expect(hits).toHaveLength(1)
    expect(hits[0].servers).toEqual(['Hub', 'NA'])
    expect(hits[0].displayName).toBe('Volence')
    expect(hits[0].nickname).toBe('Vol')
  })
  it('fetches one profile with its servers', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    expect(await gw.fetchProfile('222222222222222222')).toEqual({ id: '222222222222222222', username: 'zed', displayName: 'Zed', avatar: null, servers: ['Hub'] })
    expect(await gw.fetchProfile('333333333333333333')).toBeNull()
  })
  it('returns join dates per guild', async () => {
    const gw = createGuildGateway({ guilds: async () => [hub, na] })
    expect(await gw.joinDates('111111111111111111')).toEqual([
      { guildId: 'g1', label: 'Hub', joinedAt: '2024-01-01T00:00:00.000Z' },
      { guildId: 'g2', label: 'NA', joinedAt: '2024-06-01T00:00:00.000Z' },
    ])
  })
  it('fetchProfile rethrows a non-Unknown-Member error', async () => {
    const broken: GuildLike = { ...hub, fetchMember: async () => { throw new Error('boom') } }
    const gw = createGuildGateway({ guilds: async () => [broken] })
    await expect(gw.fetchProfile('111111111111111111')).rejects.toThrow('boom')
  })
  it('fetchProfile ignores Unknown Member on one guild and still returns servers from another', async () => {
    const brokenUnknownMember: GuildLike = {
      ...hub,
      fetchMember: async () => { const e: any = new Error('Unknown Member'); e.code = 10007; throw e },
    }
    const gw = createGuildGateway({ guilds: async () => [brokenUnknownMember, na] })
    const profile = await gw.fetchProfile('111111111111111111')
    expect(profile?.servers).toEqual(['NA'])
  })
  it('treats Unknown User (10013) like Unknown Member, not like an outage', async () => {
    const unknownUser: GuildLike = {
      ...hub,
      fetchMember: async () => { const e: any = new Error('Unknown User'); e.code = 10013; throw e },
    }
    const gw = createGuildGateway({ guilds: async () => [unknownUser] })
    expect(await gw.fetchProfile('444444444444444444')).toBeNull()
    expect(await gw.isMember('444444444444444444')).toBe(false)
    expect(await gw.joinDates('444444444444444444')).toEqual([])
  })
  it('joinDates rethrows a non-Unknown-Member error', async () => {
    const broken: GuildLike = { ...hub, fetchMember: async () => { throw new Error('boom') } }
    const gw = createGuildGateway({ guilds: async () => [broken] })
    await expect(gw.joinDates('111111111111111111')).rejects.toThrow('boom')
  })
})

describe('snowflakeCreatedAt', () => {
  it('decodes the Discord epoch', () => {
    expect(snowflakeCreatedAt('175928847299117063').toISOString()).toBe('2016-04-30T11:18:25.796Z')
  })
})
