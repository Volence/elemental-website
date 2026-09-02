import type { Guild, GuildMember } from 'discord.js'

export interface DiscordProfile {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

export interface MemberHit extends DiscordProfile {
  nickname: string | null
  servers: string[]
  joinedAt: string | null
}

/** Minimal guild shape so tests can fake discord.js. */
export interface GuildLike {
  id: string
  label: string
  fetchMember(discordId: string): Promise<RawMember>
  searchMembers(query: string, limit: number): Promise<RawMember[]>
  allMembers(): Promise<RawMember[]>
}

export interface RawMember {
  id: string
  username: string
  globalName: string | null
  nickname: string | null
  avatar: string | null
  joinedAt: string | null
}

export interface GuildGatewayDeps {
  guilds: () => Promise<GuildLike[]>
}

export interface GuildGateway {
  isMember(discordId: string): Promise<boolean | null>
  searchMembers(query: string, limit?: number): Promise<MemberHit[]>
  listAllMembers(): Promise<MemberHit[]>
  fetchProfile(discordId: string): Promise<(DiscordProfile & { servers: string[] }) | null>
  joinDates(discordId: string): Promise<Array<{ guildId: string; label: string; joinedAt: string | null }>>
}

const UNKNOWN_MEMBER = 10007

function toProfile(m: RawMember): DiscordProfile {
  return { id: m.id, username: m.username, displayName: m.globalName || m.username, avatar: m.avatar }
}

function mergeHits(perGuild: Array<{ label: string; members: RawMember[] }>): MemberHit[] {
  const byId = new Map<string, MemberHit>()
  for (const { label, members } of perGuild) {
    for (const m of members) {
      const existing = byId.get(m.id)
      if (existing) {
        existing.servers.push(label)
        if (!existing.nickname && m.nickname) existing.nickname = m.nickname
      } else {
        byId.set(m.id, { ...toProfile(m), nickname: m.nickname, servers: [label], joinedAt: m.joinedAt })
      }
    }
  }
  return [...byId.values()]
}

export function createGuildGateway(deps: GuildGatewayDeps): GuildGateway {
  return {
    async isMember(discordId) {
      const guilds = await deps.guilds()
      if (guilds.length === 0) return null
      let sawError = false
      for (const g of guilds) {
        try {
          await g.fetchMember(discordId)
          return true
        } catch (e: any) {
          if (e?.code !== UNKNOWN_MEMBER) sawError = true
        }
      }
      return sawError ? null : false
    },
    async searchMembers(query, limit = 20) {
      const guilds = await deps.guilds()
      const perGuild = await Promise.all(
        guilds.map(async (g) => ({ label: g.label, members: await g.searchMembers(query, limit).catch(() => []) })),
      )
      return mergeHits(perGuild).slice(0, limit)
    },
    async listAllMembers() {
      const guilds = await deps.guilds()
      const perGuild = await Promise.all(
        guilds.map(async (g) => ({ label: g.label, members: await g.allMembers().catch(() => []) })),
      )
      return mergeHits(perGuild)
    },
    async fetchProfile(discordId) {
      const guilds = await deps.guilds()
      let profile: DiscordProfile | null = null
      const servers: string[] = []
      for (const g of guilds) {
        try {
          const m = await g.fetchMember(discordId)
          profile = profile ?? toProfile(m)
          servers.push(g.label)
        } catch (e: any) {
          if (e?.code !== UNKNOWN_MEMBER) throw e
        }
      }
      return profile ? { ...profile, servers } : null
    },
    async joinDates(discordId) {
      const guilds = await deps.guilds()
      const out: Array<{ guildId: string; label: string; joinedAt: string | null }> = []
      for (const g of guilds) {
        try {
          const m = await g.fetchMember(discordId)
          out.push({ guildId: g.id, label: g.label, joinedAt: m.joinedAt })
        } catch (e: any) {
          if (e?.code !== UNKNOWN_MEMBER) throw e
        }
      }
      return out
    },
  }
}

export function snowflakeCreatedAt(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + 1420070400000n))
}

// ---- production wiring -------------------------------------------------------

function wrapMember(m: GuildMember): RawMember {
  return {
    id: m.id,
    username: m.user.username,
    globalName: m.user.globalName ?? null,
    nickname: m.nickname ?? null,
    avatar: m.user.avatar ?? null,
    joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
  }
}

function wrapGuild(guild: Guild, label: string): GuildLike {
  return {
    id: guild.id,
    label,
    async fetchMember(discordId) {
      return wrapMember(await guild.members.fetch(discordId))
    },
    async searchMembers(query, limit) {
      const res = await guild.members.search({ query, limit })
      return [...res.values()].map(wrapMember)
    },
    async allMembers() {
      // The logging module fetches the full roster on ready, so the cache is normally warm.
      const members = guild.members.cache.size > 0 ? guild.members.cache : await guild.members.fetch()
      return [...members.values()].map(wrapMember)
    },
  }
}

/** Registered, active servers the bot is actually in. Empty when the bot is unavailable. */
export async function getGuildGateway(): Promise<GuildGateway> {
  return createGuildGateway({
    guilds: async () => {
      const [{ ensureDiscordClient }, { getPayload }, { default: config }] = await Promise.all([
        import('@/discord/bot'),
        import('payload'),
        import('@payload-config'),
      ])
      const client = await ensureDiscordClient()
      if (!client) return []
      let registered: Array<{ guildId: string; label: string }>
      try {
        const payload = await getPayload({ config })
        const servers = await payload.find({ collection: 'discord-servers', where: { active: { equals: true } }, limit: 50, overrideAccess: true })
        registered = servers.docs.map((s: any) => ({ guildId: String(s.guildId), label: String(s.label) }))
      } catch (err) {
        console.error('[identity] discord-servers registry unavailable:', err)
        return []
      }
      if (registered.length === 0 && process.env.DISCORD_GUILD_ID) {
        registered.push({ guildId: process.env.DISCORD_GUILD_ID, label: 'Elemental' })
      }
      const out: GuildLike[] = []
      for (const r of registered) {
        const guild = client.guilds.cache.get(r.guildId) ?? (await client.guilds.fetch(r.guildId).catch(() => null))
        if (guild) out.push(wrapGuild(guild, r.label))
      }
      return out
    },
  })
}
