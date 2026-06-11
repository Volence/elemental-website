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
import { userMention } from '../identity'
import { truncate } from '../diff'
import { attachmentMetadata } from '../attachments'
import { setUserAuthor } from '../attribution'
import { Colors } from '../colors'

function guildIdOf(msg: Message | PartialMessage): string | null {
  return msg.guild?.id ?? null
}

/**
 * Readable author for the embed body. Plain text on purpose: `<@id>` mentions inside
 * embeds only render when the viewer's client has the user cached, so they frequently
 * show as raw `<@123...>`. The clickable mention goes in the message CONTENT instead
 * (see postLog's `content` option), where Discord always renders it.
 */
function authorLabel(author: User | null): string {
  return author ? `**${author.tag}**` : 'Unknown author'
}

/**
 * Audit-log rescue for deletes of uncached messages ("Unknown author / not cached"):
 * when a mod/another user deletes a message, the audit log records the message author
 * as the target and the deleter as the executor - recoverable even when the bot never
 * had the message cached (e.g. it predates the last restart). Self-deletes write no
 * audit entry, so those stay unknown when uncached. Returns the author (when it had
 * to be recovered) and the deleter when it wasn't the author themself.
 */
async function resolveDeletion(
  client: Client,
  msg: Message | PartialMessage,
): Promise<{ author: User | null; deleterId: string | null }> {
  let author = msg.author ?? null
  let deleterId: string | null = null
  const guild = msg.guild
  if (!guild) return { author, deleterId }
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 })
    const entry = logs.entries.find(
      (e) =>
        (e.extra as any)?.channel?.id === msg.channelId &&
        (!author || String(e.targetId) === author.id) &&
        Date.now() - e.createdTimestamp < 30000,
    )
    if (entry) {
      deleterId = entry.executorId ?? null
      if (!author && entry.targetId) {
        author = await client.users.fetch(String(entry.targetId)).catch(() => null)
      }
    }
  } catch {
    // Missing View Audit Log permission or transient error - fall back to cache-only info.
  }
  if (deleterId && author && deleterId === author.id) deleterId = null
  return { author, deleterId }
}

export function attachMessageHandlers(client: Client, payload: Payload): void {
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    const guildId = guildIdOf(newMsg)
    if (!guildId || newMsg.author?.bot) return
    const before = oldMsg.partial ? null : oldMsg.content
    const after = newMsg.content ?? ''
    if (before === after) return
    const jumpUrl = `https://discord.com/channels/${guildId}/${newMsg.channelId}/${newMsg.id}`
    const beforeText = before === null ? '_not cached_' : truncate(before || '_empty_', 900)
    const afterText = truncate(after || '_empty_', 900)
    const embed = new EmbedBuilder()
      .setColor(Colors.update)
      .setTitle('Message edited')
      .setDescription(
        `${authorLabel(newMsg.author ?? null)} in <#${newMsg.channelId}> - [Jump to message](${jumpUrl})\n\n` +
          `**Before:** ${beforeText}\n**After:** ${afterText}`,
      )
      .setFooter({ text: `ID: ${newMsg.id}` })
    if (newMsg.author) setUserAuthor(embed, newMsg.author)
    await postLog(client, payload, guildId, 'message', embed, {
      content: newMsg.author ? userMention(newMsg.author.id) : undefined,
    })
  })

  client.on(Events.MessageDelete, async (msg) => {
    const guildId = guildIdOf(msg)
    if (!guildId || msg.author?.bot) return
    const content = msg.partial ? null : msg.content
    const { author, deleterId } = await resolveDeletion(client, msg)
    if (author?.bot) return
    const embed = new EmbedBuilder()
      .setColor(Colors.delete)
      .setTitle('Message deleted')
      .setDescription(
        `${authorLabel(author)} in <#${msg.channelId}>\n\n` +
          `**Content:** ${content === null ? '_not cached_' : truncate(content || '_empty_', 900)}`,
      )
      .setFooter({ text: `ID: ${msg.id}` })
    if (deleterId) {
      embed.addFields({ name: 'Deleted by', value: userMention(deleterId) })
    }
    if (author) setUserAuthor(embed, author)
    if (!msg.partial && msg.attachments?.size) {
      const metas = attachmentMetadata([...msg.attachments.values()] as any)
      embed.addFields({
        name: 'Attachments (metadata only)',
        value: truncate(metas.map((m) => `${m.name} (${m.contentType ?? '?'}, ${m.size}b)`).join('\n'), 1000),
      })
    }
    await postLog(client, payload, guildId, 'message', embed, {
      content: author ? userMention(author.id) : undefined,
    })
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
    await postLog(client, payload, guildId, 'message', embed)
  })
}
