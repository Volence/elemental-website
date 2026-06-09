import { AuditLogEvent, type Client, type Guild, type GuildMember, type User, type EmbedBuilder } from 'discord.js'

/** Discord deep-link that opens a user's profile - makes the embed author clickable. */
function profileUrl(id: string): string {
  return `https://discord.com/users/${id}`
}

/** Put a user's avatar + clickable name at the top of the embed (carlbot-style, but linked). */
export function setUserAuthor(embed: EmbedBuilder, user: User): void {
  embed.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 128 }), url: profileUrl(user.id) })
}

export function setMemberAuthor(embed: EmbedBuilder, member: GuildMember): void {
  embed.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL({ size: 128 }), url: profileUrl(member.id) })
}

/** Resolve an actor id to a user and set them as the embed author. No-op if unresolved. */
export async function setActorAuthor(client: Client, embed: EmbedBuilder, actorId: string | null): Promise<void> {
  if (!actorId) return
  const user = await client.users.fetch(actorId).catch(() => null)
  if (user) setUserAuthor(embed, user)
}

/**
 * Set the embed author to the ACTOR (clickable, with avatar) so "who did it" is prominent
 * and links to their profile. Falls back to the affected member when the actor can't be
 * resolved (e.g. a self-action or an audit miss). The footer is a Discord-imposed dead end -
 * it can't be clickable - so the actor goes in the author slot instead.
 */
export async function setActorAuthorOrUser(
  client: Client,
  embed: EmbedBuilder,
  actorId: string | null,
  fallbackUser: User,
): Promise<void> {
  if (actorId) {
    const u = await client.users.fetch(actorId).catch(() => null)
    if (u) {
      setUserAuthor(embed, u)
      return
    }
  }
  setUserAuthor(embed, fallbackUser)
}

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

export interface RoleChange {
  added: string[]
  removed: string[]
  executorId: string | null
}

/**
 * Read the recent MemberRoleUpdate audit entry for a member and return exactly which roles
 * were added/removed plus who did it. Works even when the member isn't cached (so role
 * changes log regardless of cache state). Returns null when no recent entry is found.
 */
export async function fetchRoleChange(guild: Guild, targetId: string): Promise<RoleChange | null> {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 })
    const entry = logs.entries.find((e) => String(e.targetId) === String(targetId))
    if (!entry) return null
    if (Date.now() - entry.createdTimestamp > 15000) return null
    const added: string[] = []
    const removed: string[] = []
    for (const change of entry.changes) {
      const ids = Array.isArray((change as any).new)
        ? (change as any).new.map((r: any) => r.id).filter(Boolean)
        : []
      if (change.key === '$add') added.push(...ids)
      else if (change.key === '$remove') removed.push(...ids)
    }
    return { added, removed, executorId: entry.executorId ?? null }
  } catch {
    return null
  }
}
