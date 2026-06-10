import { Events, EmbedBuilder, Guild, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { attachMessageHandlers } from './handlers/messages'
import { attachMemberHandlers } from './handlers/members'
import { attachStructureHandlers } from './handlers/structure'
import { attachModerationHandlers } from './handlers/moderation'
import { postLog } from './sink'
import { userMention } from './identity'
import { setUserAuthor } from './attribution'
import { Colors } from './colors'
import { primeInviteCache, refreshInviteCache } from './invites'
import { postHeartbeat, markDisconnected } from './heartbeat'

/**
 * Self-contained logging module entry point. Designed to be extractable: the only
 * dependencies are a connected Client and a Payload instance. `now` is injectable for tests.
 */
export function setupLogging(client: Client, payload: Payload, now: () => number = () => Date.now()): void {
  attachMessageHandlers(client, payload)
  attachMemberHandlers(client, payload, now)
  attachStructureHandlers(client, payload)
  attachModerationHandlers(client, payload)

  // Global username / display-name / avatar changes -> each shared guild's profile channel.
  client.on(Events.UserUpdate, async (oldU, newU) => {
    const avatarChanged = oldU.avatar !== newU.avatar
    if (oldU.username === newU.username && oldU.globalName === newU.globalName && !avatarChanged) return
    const changes: string[] = []
    if (oldU.username !== newU.username) changes.push(`Username: ${oldU.username} -> ${newU.username}`)
    if (oldU.globalName !== newU.globalName) changes.push(`Display name: ${oldU.globalName ?? '_none_'} -> ${newU.globalName ?? '_none_'}`)
    if (avatarChanged) changes.push('Avatar changed')
    // Best-effort: only guilds where the member is cached are covered. The member cache is
    // capped/swept, so profile changes for less-active members in large guilds may be missed.
    // Fetching every guild's member on every UserUpdate would be too expensive.
    for (const guild of client.guilds.cache.values()) {
      if (!guild.members.cache.has(newU.id)) continue
      const embed = new EmbedBuilder()
        .setColor(Colors.profile)
        .setTitle('Profile changed')
        .setDescription(`${userMention(newU.id)} (${newU.tag})`)
        .addFields({ name: 'Changes', value: changes.join('\n') })
        .setFooter({ text: `ID: ${newU.id}` })
      setUserAuthor(embed, newU)
      if (avatarChanged) embed.setThumbnail(newU.displayAvatarURL({ size: 256 }))
      await postLog(client, payload, guild.id, 'profile', embed)
    }
  })

  // Keep invite cache fresh so resolveJoinInvite stays accurate.
  client.on(Events.InviteCreate, (invite) => {
    if (invite.guild instanceof Guild) refreshInviteCache(invite.guild)
  })
  client.on(Events.InviteDelete, (invite) => {
    if (invite.guild instanceof Guild) refreshInviteCache(invite.guild)
  })

  // Work to do once the gateway is ready: cache the full member roster (so leave/kick
  // embeds, member-update diffs, and profile fan-out have members cached), prime the invite
  // cache, and post the startup heartbeat.
  const onReady = async () => {
    for (const guild of client.guilds.cache.values()) {
      // Fire-and-forget per guild so a slow/large fetch never blocks startup.
      guild.members.fetch().catch(() => {})
    }
    await primeInviteCache(client)
    await postHeartbeat(client, payload, now())
  }

  client.on(Events.ClientReady, onReady)
  // ClientReady may have ALREADY fired before setupLogging registered the listener above
  // (the client connects during onInit, before this runs) - so run it now if so.
  if (client.isReady()) void onReady()

  client.on(Events.ShardDisconnect, () => markDisconnected(now()))
  client.on(Events.ShardResume, async () => {
    await postHeartbeat(client, payload, now())
  })
}
