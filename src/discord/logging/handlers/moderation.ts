import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { subjectLabel } from '../identity'
import { truncate } from '../diff'
import { fetchActorId, setActorAuthorOrUser } from '../attribution'
import { Colors } from '../colors'

export function attachModerationHandlers(client: Client, payload: Payload): void {
  client.on(Events.GuildBanAdd, async (ban) => {
    const embed = new EmbedBuilder()
      .setColor(Colors.ban)
      .setTitle('Member banned')
      .setDescription(subjectLabel(ban.user.tag, ban.user.id))
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
      .setDescription(subjectLabel(ban.user.tag, ban.user.id))
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `ID: ${ban.user.id}` })
    await setActorAuthorOrUser(client, embed, await fetchActorId(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id), ban.user)
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })
}
