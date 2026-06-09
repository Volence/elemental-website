import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention } from '../identity'
import { truncate } from '../diff'
import { fetchActorId, setActorAuthorOrUser } from '../attribution'
import { Colors } from '../colors'

export function attachModerationHandlers(client: Client, payload: Payload): void {
  client.on(Events.GuildBanAdd, async (ban) => {
    const embed = new EmbedBuilder()
      .setColor(Colors.ban)
      .setTitle('Member banned')
      .setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
      .addFields({ name: 'Reason', value: truncate(ban.reason ?? '_none provided_', 1024) })
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `ID: ${ban.user.id}` })
    await setActorAuthorOrUser(client, embed, await fetchActorId(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id), ban.user)
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })

  client.on(Events.GuildBanRemove, async (ban) => {
    const embed = new EmbedBuilder()
      .setColor(Colors.create)
      .setTitle('Member unbanned')
      .setDescription(`${userMention(ban.user.id)} (${ban.user.tag})`)
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `ID: ${ban.user.id}` })
    await setActorAuthorOrUser(client, embed, await fetchActorId(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id), ban.user)
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })
}
