import { EmbedBuilder, type TextChannel } from 'discord.js'
import { getDiscordClient } from '../bot'
import prisma from '@/lib/prisma'

type PugTier = 'open' | 'invite'

function getChannelId(tier: PugTier): string | undefined {
  return tier === 'open'
    ? process.env.DISCORD_PUG_OPEN_FEED_CHANNEL_ID
    : process.env.DISCORD_PUG_INVITE_FEED_CHANNEL_ID
}

async function getChannel(tier: PugTier): Promise<TextChannel | null> {
  const client = getDiscordClient()
  if (!client) return null
  const channelId = getChannelId(tier)
  if (!channelId) return null

  try {
    const channel = await client.channels.fetch(channelId)
    return channel instanceof Object && 'send' in channel ? (channel as TextChannel) : null
  } catch {
    return null
  }
}

function buildLobbyEmbed(lobby: {
  id: number
  lobbyNumber: number
  status: string
  players: Array<{ userId: number; queuedRoles: string[]; assignedRole?: string | null; team?: number | null; isCaptain: boolean }>
}): EmbedBuilder {
  const statusColors: Record<string, number> = {
    OPEN: 0x3498db,
    READY: 0xf1c40f,
    DRAFTING: 0xe67e22,
    MAP_VOTE: 0x9b59b6,
    BANNING: 0xe74c3c,
    IN_PROGRESS: 0x2ecc71,
    REPORTING: 0x95a5a6,
    COMPLETED: 0x27ae60,
    CANCELLED: 0x7f8c8d,
    DISPUTED: 0xe74c3c,
  }

  const embed = new EmbedBuilder()
    .setTitle(`PUG #${lobby.lobbyNumber}`)
    .setColor(statusColors[lobby.status] ?? 0x95a5a6)
    .addFields(
      { name: 'Status', value: lobby.status, inline: true },
      { name: 'Players', value: `${lobby.players.length}/10`, inline: true },
    )

  if (lobby.status === 'OPEN') {
    const roles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']
    const filled: Record<string, number> = {}
    for (const role of roles) filled[role] = 0
    for (const p of lobby.players) {
      for (const role of p.queuedRoles) {
        if (filled[role] !== undefined) filled[role]++
      }
    }
    const rolesDisplay = roles
      .map((r) => `${filled[r]}/2 ${r.replace(/_/g, '-')}`)
      .join('\n')
    embed.addFields({ name: 'Role Slots', value: rolesDisplay || 'None filled' })
    embed.setDescription(`Join at: https://elemental.gg/pugs/lobby/${lobby.id}`)
  }

  return embed
}

export async function updateLobbyFeed(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    include: { players: true },
  })
  if (!lobby) return

  const channel = await getChannel(lobby.tier as PugTier)
  if (!channel) return

  if (['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(lobby.status)) {
    if (lobby.discordFeedMessageId) {
      try {
        const msg = await channel.messages.fetch(lobby.discordFeedMessageId)
        await msg.delete()
      } catch {
        // Message already gone
      }
      await prisma.pugLobby.update({
        where: { id: lobbyId },
        data: { discordFeedMessageId: null },
      })
    }
    return
  }

  const embed = buildLobbyEmbed(lobby as Parameters<typeof buildLobbyEmbed>[0])

  if (lobby.discordFeedMessageId) {
    try {
      const msg = await channel.messages.fetch(lobby.discordFeedMessageId)
      await msg.edit({ embeds: [embed] })
      return
    } catch {
      // Message deleted - fall through to create new
    }
  }

  const message = await channel.send({ embeds: [embed] })
  await prisma.pugLobby.update({
    where: { id: lobbyId },
    data: { discordFeedMessageId: message.id },
  })
}

export async function postFeedNotification(tier: PugTier, content: string): Promise<void> {
  const channel = await getChannel(tier)
  if (!channel) return
  await channel.send(content).catch(console.error)
}
