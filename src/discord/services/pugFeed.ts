import { EmbedBuilder, type TextChannel } from 'discord.js'
import { ensureDiscordClient } from '../bot'
import prisma from '@/lib/prisma'

type PugTier = 'open' | 'invite'

function getFeedChannelId(tier: PugTier): string | undefined {
  return tier === 'open'
    ? process.env.DISCORD_PUG_OPEN_FEED_CHANNEL_ID
    : process.env.DISCORD_PUG_INVITE_FEED_CHANNEL_ID
}

function getResultsChannelId(tier: PugTier): string | undefined {
  return tier === 'open'
    ? process.env.DISCORD_PUG_OPEN_RESULTS_CHANNEL_ID
    : process.env.DISCORD_PUG_INVITE_RESULTS_CHANNEL_ID
}

async function fetchTextChannel(channelId: string): Promise<TextChannel | null> {
  const client = await ensureDiscordClient()
  if (!client || !channelId) return null
  try {
    const channel = await client.channels.fetch(channelId)
    return channel instanceof Object && 'send' in channel ? (channel as TextChannel) : null
  } catch {
    return null
  }
}

async function getChannel(tier: PugTier): Promise<TextChannel | null> {
  const channelId = getFeedChannelId(tier)
  if (!channelId) return null
  return fetchTextChannel(channelId)
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
    const playerRoles = lobby.players.map((p) => ({ queuedRoles: p.queuedRoles as string[] }))

    function canAllBeAssigned(players: Array<{ queuedRoles: string[] }>): boolean {
      const slots: Record<string, number> = { tank: 0, flex_dps: 0, hitscan_dps: 0, flex_support: 0, main_support: 0 }
      function bt(i: number): boolean {
        if (i === players.length) return true
        for (const r of players[i].queuedRoles) {
          if ((slots[r] ?? 0) < 2) { slots[r]++; if (bt(i + 1)) return true; slots[r]-- }
        }
        return false
      }
      return bt(0)
    }

    const spotsAvailable: Record<string, number> = {}
    for (const role of roles) {
      const with1 = [...playerRoles, { queuedRoles: [role] }]
      if (!canAllBeAssigned(with1)) { spotsAvailable[role] = 0; continue }
      const with2 = [...with1, { queuedRoles: [role] }]
      spotsAvailable[role] = canAllBeAssigned(with2) ? 2 : 1
    }

    const open = roles.filter((r) => spotsAvailable[r] > 0)
    const rolesDisplay = open.length > 0
      ? open.map((r) => `${spotsAvailable[r]}× ${r.replace(/_/g, '-')}`).join('\n')
      : 'All slots filled'
    embed.addFields({ name: 'Spots Needed', value: rolesDisplay })
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

export async function postMatchResult(
  tier: PugTier,
  lobbyNumber: number,
  lobbyId: number,
  result: 'team1' | 'team2' | 'draw',
  players: Array<{ userId: number; team: number | null; name: string }>,
): Promise<void> {
  const channelId = getResultsChannelId(tier)
  if (!channelId) return
  const channel = await fetchTextChannel(channelId)
  if (!channel) return

  const resultText = result === 'team1' ? 'Team 1 won' : result === 'team2' ? 'Team 2 won' : 'Draw'
  const team1Names = players.filter((p) => p.team === 1).map((p) => p.name).join(', ')
  const team2Names = players.filter((p) => p.team === 2).map((p) => p.name).join(', ')

  const embed = new EmbedBuilder()
    .setTitle(`PUG #${lobbyNumber} - Result`)
    .setColor(result === 'draw' ? 0x95a5a6 : 0x27ae60)
    .addFields(
      { name: 'Result', value: resultText, inline: true },
      { name: 'Team 1', value: team1Names || '-', inline: true },
      { name: 'Team 2', value: team2Names || '-', inline: true },
    )
    .setDescription(`[View lobby](https://elemental.gg/pugs/lobby/${lobbyId})`)
    .setTimestamp()

  await channel.send({ embeds: [embed] }).catch(console.error)
}
