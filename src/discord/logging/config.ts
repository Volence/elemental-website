import type { Payload } from 'payload'
import type { LoggingConfig } from './channels'

const TTL_MS = 60_000
const configCache = new Map<string, { cfg: LoggingConfig | null; expires: number }>()

/** Invalidate the cached config for a specific guild, or all guilds when no arg is given. */
export function clearLoggingConfigCache(guildId?: string): void {
  if (guildId !== undefined) {
    configCache.delete(guildId)
  } else {
    configCache.clear()
  }
}

/** Load logging config for a guild from the discord-servers registry. Returns null if not found. */
export async function loadLoggingConfig(payload: Payload, guildId: string): Promise<LoggingConfig | null> {
  const cached = configCache.get(guildId)
  if (cached && Date.now() < cached.expires) return cached.cfg

  const { docs } = await payload.find({
    collection: 'discord-servers' as any,
    where: { guildId: { equals: guildId } },
    limit: 1,
    depth: 0,
  })
  const row: any = docs[0]
  const cfg: LoggingConfig | null = row
    ? {
        enableLogging: !!row.enableLogging,
        messageLogChannelId: row.messageLogChannelId ?? null,
        joinLeaveLogChannelId: row.joinLeaveLogChannelId ?? null,
        memberLogChannelId: row.memberLogChannelId ?? null,
        profileLogChannelId: row.profileLogChannelId ?? null,
        serverLogChannelId: row.serverLogChannelId ?? null,
        newAccountFlagDays: typeof row.newAccountFlagDays === 'number' ? row.newAccountFlagDays : 7,
        attachProfileLink: row.attachProfileLink !== false,
      }
    : null

  configCache.set(guildId, { cfg, expires: Date.now() + TTL_MS })
  return cfg
}
