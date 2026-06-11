import { EmbedBuilder, Events, AuditLogEvent, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'
import { userMention, subjectLabel } from '../identity'
import { truncate } from '../diff'
import { fetchAuditEntryWithRetry, setUserAuthor } from '../attribution'
import { Colors } from '../colors'

export function attachModerationHandlers(client: Client, payload: Payload): void {
  client.on(Events.GuildBanAdd, async (ban) => {
    // The audit entry can lag the gateway event - retry so 'Banned by' resolves.
    const audit = await fetchAuditEntryWithRetry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id)
    const embed = new EmbedBuilder()
      .setColor(Colors.ban)
      .setTitle('Member banned')
      .setDescription(subjectLabel(ban.user.tag, ban.user.id))
      .addFields(
        // Explicit, even when unknown: silently falling back to the banned user in the
        // header read as "they banned themselves".
        { name: 'Banned by', value: audit?.executorId ? userMention(audit.executorId) : 'unknown' },
        { name: 'Reason', value: truncate(audit?.reason ?? ban.reason ?? '_none provided_', 1024) },
      )
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `ID: ${ban.user.id}` })
    setUserAuthor(embed, ban.user)
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })

  client.on(Events.GuildBanRemove, async (ban) => {
    const audit = await fetchAuditEntryWithRetry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id)
    const embed = new EmbedBuilder()
      .setColor(Colors.create)
      .setTitle('Member unbanned')
      .setDescription(subjectLabel(ban.user.tag, ban.user.id))
      .addFields({
        name: 'Unbanned by',
        value: audit?.executorId ? userMention(audit.executorId) : 'unknown',
      })
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `ID: ${ban.user.id}` })
    setUserAuthor(embed, ban.user)
    await postLog(client, payload, ban.guild.id, 'member', embed)
  })
}
