import { EmbedBuilder, Events, type Client, type Message, type PartialMessage } from 'discord.js'
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

/** Who the message is from, for the description line. Avoids a broken `<@0>` when unresolved. */
function authorLabel(msg: Message | PartialMessage): string {
  return msg.author ? userMention(msg.author.id) : 'Unknown author'
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
        `${authorLabel(newMsg)} in <#${newMsg.channelId}> - [Jump to message](${jumpUrl})\n\n` +
          `**Before:** ${beforeText}\n**After:** ${afterText}`,
      )
      .setFooter({ text: `ID: ${newMsg.id}` })
    if (newMsg.author) setUserAuthor(embed, newMsg.author)
    await postLog(client, payload, guildId, 'message', embed)
  })

  client.on(Events.MessageDelete, async (msg) => {
    const guildId = guildIdOf(msg)
    if (!guildId || msg.author?.bot) return
    const content = msg.partial ? null : msg.content
    const embed = new EmbedBuilder()
      .setColor(Colors.delete)
      .setTitle('Message deleted')
      .setDescription(
        `${authorLabel(msg)} in <#${msg.channelId}>\n\n` +
          `**Content:** ${content === null ? '_not cached_' : truncate(content || '_empty_', 900)}`,
      )
      .setFooter({ text: `ID: ${msg.id}` })
    if (msg.author) setUserAuthor(embed, msg.author)
    if (!msg.partial && msg.attachments?.size) {
      const metas = attachmentMetadata([...msg.attachments.values()] as any)
      embed.addFields({
        name: 'Attachments (metadata only)',
        value: truncate(metas.map((m) => `${m.name} (${m.contentType ?? '?'}, ${m.size}b)`).join('\n'), 1000),
      })
    }
    await postLog(client, payload, guildId, 'message', embed)
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
