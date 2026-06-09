import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ensureDiscordClient } from '@/discord/bot'

/** Minimal registry shape the pure decision needs. */
export interface RegistryServer {
  id: string | number
  guildId: string
  active: boolean
  isPrimary: boolean
}

/** Thrown when a serverId cannot be resolved to a usable guild. */
export class ServerResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerResolutionError'
  }
}

/**
 * Pure decision: which guild id does a (possibly absent) serverId resolve to?
 * No serverId -> the primary (env var is canonical for primary). Otherwise the
 * registered, active server the bot is actually in. Never silently falls through.
 */
export function pickGuildId(params: {
  serverId?: string | null
  servers: RegistryServer[]
  primaryEnvGuildId?: string
  botGuildIds: Set<string>
}): string {
  const { serverId, servers, primaryEnvGuildId, botGuildIds } = params

  if (serverId === null || serverId === undefined || serverId === '') {
    if (!primaryEnvGuildId) {
      throw new ServerResolutionError('Primary server not configured (DISCORD_GUILD_ID)')
    }
    return primaryEnvGuildId
  }

  const server = servers.find((s) => String(s.id) === String(serverId))
  if (!server) throw new ServerResolutionError('Unknown server')
  if (!server.active) throw new ServerResolutionError('Server is inactive')
  if (!botGuildIds.has(server.guildId)) {
    throw new ServerResolutionError('Bot is not a member of that server')
  }
  return server.guildId
}

/**
 * Async wrapper used by routes: gathers the registry + the bot's guilds and
 * resolves the guild id, falling back to the primary when serverId is absent.
 * Throws ServerResolutionError on any invalid selection.
 */
export async function resolveGuildId(serverId?: string | null): Promise<string> {
  const payload = await getPayload({ config: configPromise })
  const client = await ensureDiscordClient()
  const botGuildIds = new Set<string>(client ? Array.from(client.guilds.cache.keys()) : [])

  let servers: RegistryServer[] = []
  try {
    const { docs } = await payload.find({ collection: 'discord-servers' as any, limit: 200, depth: 0 })
    servers = docs.map((d: any) => ({ id: d.id, guildId: d.guildId, active: d.active, isPrimary: d.isPrimary }))
  } catch {
    // Registry table may not exist yet (pre-migration) — fall back to primary only.
    servers = []
  }

  return pickGuildId({ serverId, servers, primaryEnvGuildId: process.env.DISCORD_GUILD_ID, botGuildIds })
}
