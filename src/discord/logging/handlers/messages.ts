import { EmbedBuilder, Events, type Client, type Message, type PartialMessage } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention } from '../identity'
import { truncate } from '../diff'
import { attachmentMetadata } from '../attachments'

function guildIdOf(msg: Message | PartialMessage): string | null {
  return msg.guild?.id ?? null
}

export function attachMessageHandlers(client: Client, payload: Payload): void {
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    const guildId = guildIdOf(newMsg)
    if (!guildId || newMsg.author?.bot) return
    const before = oldMsg.partial ? null : oldMsg.content
    const after = newMsg.content ?? ''
    if (before === after) return
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('Message edited')
      .setDescription(`${userMention(newMsg.author?.id ?? '0')} in <#${newMsg.channelId}>`)
      .addFields(
        { name: 'Before', value: before === null ? '_not cached_' : truncate(before || '_empty_', 1000) },
        { name: 'After', value: truncate(after || '_empty_', 1000) },
      )
    await postLog(client, payload, guildId, 'message', embed)
  })

  client.on(Events.MessageDelete, async (msg) => {
    const guildId = guildIdOf(msg)
    if (!guildId || msg.author?.bot) return
    const content = msg.partial ? null : msg.content
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Message deleted')
      .setDescription(`${msg.author ? userMention(msg.author.id) : 'Unknown author'} in <#${msg.channelId}>`)
      .addFields({ name: 'Content', value: content === null ? '_not cached_' : truncate(content || '_empty_', 1000) })
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
      .setColor(0xe74c3c)
      .setTitle('Bulk message delete (purge)')
      .setDescription(`${messages.size} messages deleted in <#${first?.channelId}>`)
    await postLog(client, payload, guildId, 'message', embed)
  })
}
