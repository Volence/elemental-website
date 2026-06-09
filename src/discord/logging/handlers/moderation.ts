import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention } from '../identity'
import { truncate } from '../diff'

export function attachModerationHandlers(client: Client, payload: Payload): void {
  client.on(Events.GuildBanAdd, async (ban) => {
    const embed = new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle('Member banned')
      .setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
      .addFields({ name: 'Reason', value: truncate(ban.reason ?? '_none provided_', 1024) })
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })

  client.on(Events.GuildBanRemove, async (ban) => {
    const embed = new EmbedBuilder().setColor(0x27ae60).setTitle('Member unbanned').setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })

  // Actor attribution + who-did-what feed.
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    const actor = entry.executorId ? userMention(entry.executorId) : 'Unknown'
    const action = AuditLogEvent[entry.action] ?? String(entry.action)
    const embed = new EmbedBuilder()
      .setColor(0x7f8c8d)
      .setTitle(`Audit: ${action}`)
      .setDescription(`By ${actor}${entry.targetId ? ` on target \`${entry.targetId}\`` : ''}`)
    if (entry.reason) embed.addFields({ name: 'Reason', value: truncate(entry.reason, 1024) })
    await postLog(client, payload, guild.id, 'server', embed)
  })
}
