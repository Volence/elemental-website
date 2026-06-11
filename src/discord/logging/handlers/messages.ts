import {
  EmbedBuilder,
  Events,
  AuditLogEvent,
  type Client,
  type Message,
  type PartialMessage,
  type User,
} from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention, subjectLabel } from '../identity'
import { truncate } from '../diff'
import { attachmentMetadata } from '../attachments'
import { setUserAuthor } from '../attribution'
import { Colors } from '../colors'
import { loadLoggingConfig } from '../config'
import { resolveLogChannelId } from '../channels'
import {
  storeMessage,
  updateStoredMessage,
  getStoredMessage,
  deleteStoredMessage,
  type StoredMessage,
} from '../messageStore'

function guildIdOf(msg: Message | PartialMessage): string | null {
  return msg.guild?.id ?? null
}

/** Readable author for the embed body: bold name first, mention (popout link) second. */
function authorLabel(author: User | null, stored: StoredMessage | null): string {
  if (author) return subjectLabel(author.tag, author.id)
  if (stored) return subjectLabel(stored.authorTag, stored.authorId)
  return 'Unknown author'
}

/**
 * Audit-log attribution for deletes: when a mod/another user deletes a message, the
 * audit log records the message author as the target and the deleter as the executor.
 * Self-deletes write no audit entry. Returns the author (when it had to be recovered)
 * and the deleter when it wasn't the author themself.
 */
async function resolveDeletion(
  client: Client,
  msg: Message | PartialMessage,
  storedAuthorId: string | null,
): Promise<{ author: User | null; deleterId: string | null }> {
  let author = msg.author ?? null
  let deleterId: string | null = null
  const knownAuthorId = author?.id ?? storedAuthorId
  const guild = msg.guild
  if (!guild) return { author, deleterId }
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 })
    const entry = logs.entries.find(
      (e) =>
        (e.extra as any)?.channel?.id === msg.channelId &&
        (!knownAuthorId || String(e.targetId) === knownAuthorId) &&
        Date.now() - e.createdTimestamp < 30000,
    )
    if (entry) {
      deleterId = entry.executorId ?? null
      if (!author && entry.targetId) {
        author = await client.users.fetch(String(entry.targetId)).catch(() => null)
      }
    }
  } catch {
    // Missing View Audit Log permission or transient error - fall back to cache/store info.
  }
  // The DB store knows the author even for self-deletes of uncached messages.
  if (!author && storedAuthorId) {
    author = await client.users.fetch(storedAuthorId).catch(() => null)
  }
  if (deleterId && deleterId === (author?.id ?? storedAuthorId)) deleterId = null
  return { author, deleterId }
}

export function attachMessageHandlers(client: Client, payload: Payload): void {
  // Persist every human guild message (in logging-enabled guilds) so later delete/edit
  // logs survive restarts and self-deletes. See messageStore.ts for retention.
  client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.bot || msg.system) return
    const cfg = await loadLoggingConfig(payload, msg.guild.id)
    if (!cfg || !resolveLogChannelId(cfg, 'message')) return
    await storeMessage(payload, msg)
  })

  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    const guildId = guildIdOf(newMsg)
    if (!guildId || newMsg.author?.bot) return
    const after = newMsg.content ?? ''
    // Cache first; fall back to the DB store for messages from before the last restart.
    let before = oldMsg.partial ? null : oldMsg.content
    let stored: StoredMessage | null = null
    if (before === null) {
      stored = await getStoredMessage(payload, newMsg.id)
      before = stored?.content ?? null
    }
    if (before === after) return
    // Keep the store current so a later delete shows the latest text.
    void updateStoredMessage(payload, newMsg.id, after)
    const jumpUrl = `https://discord.com/channels/${guildId}/${newMsg.channelId}/${newMsg.id}`
    const beforeText = before === null ? '_not cached_' : truncate(before || '_empty_', 900)
    const afterText = truncate(after || '_empty_', 900)
    const embed = new EmbedBuilder()
      .setColor(Colors.update)
      .setTitle('Message edited')
      .setDescription(
        `${authorLabel(newMsg.author ?? null, stored)} in <#${newMsg.channelId}> - [Jump to message](${jumpUrl})\n\n` +
          `**Before:** ${beforeText}\n**After:** ${afterText}`,
      )
      .setFooter({ text: `ID: ${newMsg.id}` })
    if (newMsg.author) setUserAuthor(embed, newMsg.author)
    await postLog(client, payload, guildId, 'message', embed)
  })

  client.on(Events.MessageDelete, async (msg) => {
    const guildId = guildIdOf(msg)
    if (!guildId || msg.author?.bot) return
    const stored = msg.partial ? await getStoredMessage(payload, msg.id) : null
    const content = msg.partial ? (stored?.content ?? null) : msg.content
    const { author, deleterId } = await resolveDeletion(client, msg, stored?.authorId ?? null)
    if (author?.bot) return
    const embed = new EmbedBuilder()
      .setColor(Colors.delete)
      .setTitle('Message deleted')
      .setDescription(
        `${authorLabel(author, stored)} in <#${msg.channelId}>\n\n` +
          `**Content:** ${content === null ? '_not cached_' : truncate(content || '_empty_', 900)}`,
      )
      .setFooter({ text: `ID: ${msg.id}` })
    if (deleterId) {
      embed.addFields({ name: 'Deleted by', value: userMention(deleterId) })
    }
    if (author) setUserAuthor(embed, author)
    const metas = !msg.partial && msg.attachments?.size
      ? attachmentMetadata([...msg.attachments.values()] as any)
      : (stored?.attachments ?? [])
    if (metas.length) {
      embed.addFields({
        name: 'Attachments (metadata only)',
        value: truncate(metas.map((m) => `${m.name} (${m.contentType ?? '?'}, ${m.size}b)`).join('\n'), 1000),
      })
    }
    await postLog(client, payload, guildId, 'message', embed)
    // Consumed - drop the row so the store stays a working buffer.
    void deleteStoredMessage(payload, msg.id)
  })

  client.on(Events.MessageBulkDelete, async (messages) => {
    const first = messages.first()
    const guildId = first?.guild?.id ?? null
    if (!guildId) return
    const embed = new EmbedBuilder()
      .setColor(Colors.delete)
      .setTitle('Bulk message delete (purge)')
      .setDescription(`${messages.size} messages deleted in <#${first?.channelId}>`)
      .setFooter({ text: `Channel ID: ${first?.channelId ?? 'unknown'}` })
    // Recover per-author counts from the cache plus the DB store.
    const counts = new Map<string, number>()
    const uncachedIds: string[] = []
    for (const m of messages.values()) {
      if (!m.partial && m.author) counts.set(m.author.tag, (counts.get(m.author.tag) ?? 0) + 1)
      else uncachedIds.push(m.id)
    }
    for (const id of uncachedIds) {
      const stored = await getStoredMessage(payload, id)
      if (stored) counts.set(stored.authorTag, (counts.get(stored.authorTag) ?? 0) + 1)
    }
    if (counts.size) {
      const lines = [...counts.entries()].map(([tag, n]) => `${tag}: ${n}`)
      embed.addFields({ name: 'Authors', value: truncate(lines.join('\n'), 1024) })
    }
    await postLog(client, payload, guildId, 'message', embed)
    for (const m of messages.values()) void deleteStoredMessage(payload, m.id)
  })
}
