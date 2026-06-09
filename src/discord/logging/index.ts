import { Events, EmbedBuilder, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { attachMessageHandlers } from './handlers/messages'
import { attachMemberHandlers } from './handlers/members'
import { attachStructureHandlers } from './handlers/structure'
import { attachModerationHandlers } from './handlers/moderation'
import { postLog } from './sink'
import { userMention } from './identity'
import { primeInviteCache } from './invites'
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

  // Global username / display-name changes -> each shared guild's profile channel.
  client.on(Events.UserUpdate, async (oldU, newU) => {
    if (oldU.username === newU.username && oldU.globalName === newU.globalName) return
    const changes: string[] = []
    if (oldU.username !== newU.username) changes.push(`Username: ${oldU.username} -> ${newU.username}`)
    if (oldU.globalName !== newU.globalName) changes.push(`Display name: ${oldU.globalName ?? '_none_'} -> ${newU.globalName ?? '_none_'}`)
    for (const guild of client.guilds.cache.values()) {
      if (!guild.members.cache.has(newU.id)) continue
      const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('Profile changed').setDescription(`${userMention(newU.id)}`).addFields({ name: 'Changes', value: changes.join('\n') })
      await postLog(client, payload, guild.id, 'profile', embed)
    }
  })

  // Heartbeat + invite cache priming on (re)connect.
  client.on(Events.ClientReady, async () => {
    await primeInviteCache(client)
    await postHeartbeat(client, payload, now())
  })
  client.on(Events.ShardDisconnect, () => markDisconnected(now()))
  client.on(Events.ShardResume, async () => {
    await postHeartbeat(client, payload, now())
  })
}
