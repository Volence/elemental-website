import { AuditLogEvent, type Guild, type EmbedBuilder } from 'discord.js'
import { userMention } from './identity'

/**
 * Best-effort lookup of WHO performed an action, via the guild audit log. Returns the
 * executor's Discord user id, or null when it can't be determined (entry not yet written,
 * missing View Audit Log permission, or no recent match). The 15s recency guard avoids
 * attributing a stale entry when the new one isn't queryable yet.
 */
export async function fetchActorId(
  guild: Guild,
  type: AuditLogEvent,
  targetId?: string,
): Promise<string | null> {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 })
    const entry =
      (targetId ? logs.entries.find((e) => String(e.targetId) === String(targetId)) : null) ??
      logs.entries.first()
    if (!entry) return null
    if (Date.now() - entry.createdTimestamp > 15000) return null
    return entry.executorId ?? null
  } catch {
    return null
  }
}

/** Append a "By @user" field to an embed when an actor was resolved (no-op otherwise). */
export function addActorField(embed: EmbedBuilder, actorId: string | null): void {
  if (actorId) embed.addFields({ name: 'By', value: userMention(actorId) })
}
