import type { Payload } from 'payload'
import type { LoggingConfig } from './channels'

// Config is read fresh from the DB on every event (no in-process cache): a cache here caused
// stale config after a save, because the settings route and the long-running bot don't
// reliably share in-memory state.

/** Load logging config for a guild from the discord-servers registry. Returns null if not found. */
export async function loadLoggingConfig(payload: Payload, guildId: string): Promise<LoggingConfig | null> {
  const { docs } = await payload.find({
    collection: 'discord-servers' as any,
    where: { guildId: { equals: guildId } },
    limit: 1,
    depth: 0,
  })
  const row: any = docs[0]
  if (!row) return null
  return {
    enableLogging: !!row.enableLogging,
    messageLogChannelId: row.messageLogChannelId ?? null,
    joinLeaveLogChannelId: row.joinLeaveLogChannelId ?? null,
    memberLogChannelId: row.memberLogChannelId ?? null,
    profileLogChannelId: row.profileLogChannelId ?? null,
    serverLogChannelId: row.serverLogChannelId ?? null,
    newAccountFlagDays: typeof row.newAccountFlagDays === 'number' ? row.newAccountFlagDays : 7,
    attachProfileLink: row.attachProfileLink !== false,
  }
}
