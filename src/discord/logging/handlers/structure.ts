import { EmbedBuilder, Events, type Client, type GuildChannel } from 'discord.js'
import type { Payload } from 'payload'
import { postLog } from '../sink'

export function attachStructureHandlers(client: Client, payload: Payload): void {
  client.on(Events.ChannelCreate, async (channel) => {
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('Channel created').setDescription(`<#${channel.id}> (${channel.name})`)
    await postLog(client, payload, channel.guild.id, 'server', embed)
  })

  client.on(Events.ChannelDelete, async (channel) => {
    const gc = channel as GuildChannel
    if (!('guild' in gc) || !gc.guild) return
    const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle('Channel deleted').setDescription(`#${gc.name} (${gc.id})`)
    await postLog(client, payload, gc.guild.id, 'server', embed)
  })

  client.on(Events.ChannelUpdate, async (oldCh, newCh) => {
    const o = oldCh as GuildChannel
    const n = newCh as GuildChannel
    if (!('guild' in n) || !n.guild) return
    const changes: string[] = []
    if (o.name !== n.name) changes.push(`Renamed: ${o.name} -> ${n.name}`)
    if (o.parentId !== n.parentId) changes.push(`Moved category: ${o.parentId ?? 'none'} -> ${n.parentId ?? 'none'}`)
    // Pure position reorders are intentionally NOT logged (noisy; see spec).
    if (!changes.length) return
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Channel updated').setDescription(`<#${n.id}>`).addFields({ name: 'Changes', value: changes.join('\n') })
    await postLog(client, payload, n.guild.id, 'server', embed)
  })

  client.on(Events.GuildRoleCreate, async (role) => {
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('Role created').setDescription(`<@&${role.id}> (${role.name})`)
    await postLog(client, payload, role.guild.id, 'server', embed)
  })

  client.on(Events.GuildRoleDelete, async (role) => {
    const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle('Role deleted').setDescription(`${role.name} (${role.id})`)
    await postLog(client, payload, role.guild.id, 'server', embed)
  })

  client.on(Events.GuildRoleUpdate, async (oldR, newR) => {
    const changes: string[] = []
    if (oldR.name !== newR.name) changes.push(`Renamed: ${oldR.name} -> ${newR.name}`)
    if (oldR.permissions.bitfield !== newR.permissions.bitfield) changes.push('Permissions changed')
    if (!changes.length) return
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('Role updated').setDescription(`<@&${newR.id}>`).addFields({ name: 'Changes', value: changes.join('\n') })
    await postLog(client, payload, newR.guild.id, 'server', embed)
  })
}
