import { AuditLogEvent, type Guild, type EmbedBuilder } from 'discord.js'
import { userMention } from './identity'

/**
 * Best-effort lookup of WHO performed an action, via the guild audit log. Returns the
 * executor's Discord user id, or null when it can't be determined (entry not yet written,
 * missing View Audit Log permission, or no recent match). The 15s recency guard avoids
 * attributing a stale entry when the new one isn't queryable yet.
 */
export interface AuditMatch {
  executorId: string | null
  reason: string | null
}

/**
 * Find the recent audit entry for an action+target, returning the executor and reason.
 * Returns null when none is found within the 15s recency window (or on permission error).
 */
export async function fetchAuditEntry(
  guild: Guild,
  type: AuditLogEvent,
  targetId?: string,
): Promise<AuditMatch | null> {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 })
    const entry =
      (targetId ? logs.entries.find((e) => String(e.targetId) === String(targetId)) : null) ??
      logs.entries.first()
    if (!entry) return null
    if (Date.now() - entry.createdTimestamp > 15000) return null
    return { executorId: entry.executorId ?? null, reason: entry.reason ?? null }
  } catch {
    return null
  }
}

export async function fetchActorId(
  guild: Guild,
  type: AuditLogEvent,
  targetId?: string,
): Promise<string | null> {
  const entry = await fetchAuditEntry(guild, type, targetId)
  return entry?.executorId ?? null
}

/** Append a "By @user" field to an embed when an actor was resolved (no-op otherwise). */
export function addActorField(embed: EmbedBuilder, actorId: string | null): void {
  if (actorId) embed.addFields({ name: 'By', value: userMention(actorId) })
}
