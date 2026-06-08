import { ChannelType, OverwriteType, type Guild, type NonThreadGuildBasedChannel } from 'discord.js'
import { ensureDiscordClient } from '@/discord/bot'
import type {
  CloneSource,
  CloneRole,
  CloneCategory,
  CloneChannel,
  CloneOverwrite,
} from './clonePlan'

const COPYABLE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildStageVoice,
]

/** Extract role-typed permission overwrites from a channel as plain CloneOverwrite objects. */
function readOverwrites(channel: NonThreadGuildBasedChannel): CloneOverwrite[] {
  const out: CloneOverwrite[] = []
  channel.permissionOverwrites.cache.forEach((ow: any) => {
    if (ow.type !== OverwriteType.Role) return // skip member overwrites; members are not copied
    out.push({ roleId: ow.id, allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString() })
  })
  return out
}

/** Read the primary guild (DISCORD_GUILD_ID) into a serializable CloneSource. */
export async function readCloneSource(): Promise<CloneSource> {
  const client = await ensureDiscordClient()
  if (!client) throw new Error('Discord client not available')
  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) throw new Error('DISCORD_GUILD_ID not configured')

  const guild: Guild = await client.guilds.fetch(guildId)
  await guild.channels.fetch()
  await guild.roles.fetch()
  await guild.emojis.fetch()
  await guild.stickers.fetch()

  const roles: CloneRole[] = Array.from(guild.roles.cache.values()).map((role) => ({
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(),
    managed: role.managed,
    isEveryone: role.id === guild.id,
  }))

  // Build categories then attach channels.
  const categories = new Map<string, CloneCategory>()
  guild.channels.cache.forEach((ch) => {
    if (ch && ch.type === ChannelType.GuildCategory) {
      const ntCh = ch as NonThreadGuildBasedChannel
      categories.set(ntCh.id, {
        id: ntCh.id,
        name: ntCh.name,
        position: ntCh.position,
        overwrites: readOverwrites(ntCh),
        channels: [],
      })
    }
  })

  const uncategorized: CloneChannel[] = []
  guild.channels.cache.forEach((ch) => {
    if (!ch || !COPYABLE_CHANNEL_TYPES.includes(ch.type)) return
    const ntCh = ch as NonThreadGuildBasedChannel
    const channel: CloneChannel = {
      id: ntCh.id,
      name: ntCh.name,
      type: ntCh.type,
      // @ts-expect-error topic exists on text-like channels only
      topic: ntCh.topic ?? null,
      position: ntCh.position,
      overwrites: readOverwrites(ntCh),
    }
    const parentId = ntCh.parentId
    if (parentId && categories.has(parentId)) {
      categories.get(parentId)!.channels.push(channel)
    } else {
      uncategorized.push(channel)
    }
  })

  // Represent uncategorized channels as a synthetic category with empty id so the UI can show them.
  const categoryList = Array.from(categories.values()).sort((a, b) => a.position - b.position)
  categoryList.forEach((c) => c.channels.sort((a, b) => a.position - b.position))
  if (uncategorized.length > 0) {
    uncategorized.sort((a, b) => a.position - b.position)
    categoryList.push({ id: '__uncategorized__', name: '(no category)', position: -1, overwrites: [], channels: uncategorized })
  }

  const emojis = Array.from(guild.emojis.cache.values()).map((e) => ({
    id: e.id,
    name: e.name,
    url: e.imageURL({ size: 256 }),
  }))

  const stickers = Array.from(guild.stickers.cache.values()).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    tags: s.tags ?? '',
    url: s.url,
  }))

  const systemChannelName = guild.systemChannel?.name ?? null
  const rulesChannelName = guild.rulesChannel?.name ?? null

  return {
    roles,
    categories: categoryList,
    emojis,
    stickers,
    settings: {
      verificationLevel: guild.verificationLevel,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      explicitContentFilter: guild.explicitContentFilter,
      systemChannelName,
      rulesChannelName,
    },
  }
}
