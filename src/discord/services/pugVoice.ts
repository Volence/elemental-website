import {
  ChannelType,
  PermissionFlagsBits,
  type VoiceChannel,
  type Guild,
} from 'discord.js'
import { getDiscordClient } from '../bot'

export async function createMatchVoiceChannels(
  lobbyNumber: number,
  team1UserIds: string[],
  team2UserIds: string[],
): Promise<{ team1ChannelId: string; team2ChannelId: string }> {
  const client = getDiscordClient()
  const categoryId = process.env.DISCORD_PUG_VOICE_CATEGORY_ID
  const guildId = process.env.DISCORD_GUILD_ID

  if (!client || !categoryId || !guildId) {
    return { team1ChannelId: '', team2ChannelId: '' }
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null) as Guild | null
  if (!guild) return { team1ChannelId: '', team2ChannelId: '' }

  const createChannel = async (name: string, allowedUserIds: string[]): Promise<string> => {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: categoryId,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.Connect],
        },
        ...allowedUserIds.map((userId) => ({
          id: userId,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        })),
      ],
    })
    return channel.id
  }

  const team1ChannelId = await createChannel(`PUG #${lobbyNumber} - Team 1`, team1UserIds)
  const team2ChannelId = await createChannel(`PUG #${lobbyNumber} - Team 2`, team2UserIds)

  return { team1ChannelId, team2ChannelId }
}

export async function deleteMatchVoiceChannels(
  team1ChannelId: string,
  team2ChannelId: string,
): Promise<void> {
  const client = getDiscordClient()
  if (!client) return

  for (const channelId of [team1ChannelId, team2ChannelId]) {
    if (!channelId) continue
    try {
      const channel = await client.channels.fetch(channelId)
      if (channel && 'delete' in channel) {
        await (channel as VoiceChannel).delete()
      }
    } catch {
      // Channel already deleted or not found
    }
  }
}
