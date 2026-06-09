import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention } from '../identity'
import { truncate } from '../diff'
import { fetchActorId, addActorField } from '../attribution'

export function attachModerationHandlers(client: Client, payload: Payload): void {
  client.on(Events.GuildBanAdd, async (ban) => {
    const embed = new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle('Member banned')
      .setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
      .addFields({ name: 'Reason', value: truncate(ban.reason ?? '_none provided_', 1024) })
    addActorField(embed, await fetchActorId(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id))
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })

  client.on(Events.GuildBanRemove, async (ban) => {
    const embed = new EmbedBuilder().setColor(0x27ae60).setTitle('Member unbanned').setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
    addActorField(embed, await fetchActorId(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id))
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })
}
