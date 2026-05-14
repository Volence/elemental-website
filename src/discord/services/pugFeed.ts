import { EmbedBuilder, type TextChannel } from 'discord.js'
import { ensureDiscordClient } from '../bot'
import prisma from '@/lib/prisma'

type PugTier = 'open' | 'invite'

// Per-lobby lock to prevent race conditions when multiple updates fire concurrently
const lobbyLocks = new Map<number, Promise<void>>()
const LOBBY_LOCK_TIMEOUT_MS = 30_000

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
  tier: string
  region?: string | null
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
    if (lobby.tier === 'invite' && lobby.region) {
      embed.setDescription(`Queue at: https://elmt.gg/pugs/invite?region=${lobby.region}`)
    } else {
      embed.setDescription(`Join at: https://elmt.gg/pugs/lobby/${lobby.id}`)
    }
  }

  return embed
}

export async function updateLobbyFeed(lobbyId: number): Promise<void> {
  // Serialize concurrent calls for the same lobby to prevent duplicate messages
  const prev = lobbyLocks.get(lobbyId) ?? Promise.resolve()
  let resolve: () => void
  const current = new Promise<void>((r) => { resolve = r })
  lobbyLocks.set(lobbyId, current)
  try {
    await Promise.race([
      prev,
      new Promise<void>((r) => setTimeout(r, LOBBY_LOCK_TIMEOUT_MS)),
    ])
    await Promise.race([
      _updateLobbyFeed(lobbyId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Lobby ${lobbyId} feed update timed out`)), LOBBY_LOCK_TIMEOUT_MS),
      ),
    ])
  } catch (error) {
    console.error(`[PugFeed] Error updating lobby ${lobbyId}:`, (error as Error).message)
  } finally {
    resolve!()
    if (lobbyLocks.get(lobbyId) === current) lobbyLocks.delete(lobbyId)
  }
}

async function _updateLobbyFeed(lobbyId: number): Promise<void> {
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
      // Message deleted or not found - fall through to create new
    }
  }

  // Double-check: re-read the lobby to see if another concurrent call already created a message
  // This prevents the race where createOpenLobby and joinLobby both fire updateLobbyFeed
  // simultaneously, both see discordFeedMessageId=null, and both create messages.
  const freshLobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (freshLobby?.discordFeedMessageId && freshLobby.discordFeedMessageId !== lobby.discordFeedMessageId) {
    try {
      const msg = await channel.messages.fetch(freshLobby.discordFeedMessageId)
      await msg.edit({ embeds: [embed] })
      return
    } catch {
      // Still gone - create new below
    }
  }

  const message = await channel.send({ embeds: [embed] })
  try {
    await message.startThread({ name: `PUG #${lobby.lobbyNumber} Chat`, autoArchiveDuration: 60 })
  } catch (err) {
    console.error('Failed to start thread for lobby', err)
  }
  await prisma.pugLobby.update({
    where: { id: lobbyId },
    data: { discordFeedMessageId: message.id },
  })
}

export async function postFeedNotification(tier: PugTier, lobbyId: number, content: string): Promise<void> {
  const channel = await getChannel(tier)
  if (!channel) return

  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (lobby?.discordFeedMessageId) {
    try {
      const thread = await channel.threads.fetch(lobby.discordFeedMessageId)
      if (thread) {
        await thread.send(content)
        return
      }
    } catch (err) {
      // Fallback
    }
  }

  // Fallback to channel if thread fails or message isn't created yet
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
    .setDescription(`[View lobby](https://elmt.gg/pugs/lobby/${lobbyId})`)
    .setTimestamp()

  await channel.send({ embeds: [embed] }).catch(console.error)
}
