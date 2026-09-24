import {
  ChannelType,
  type VoiceChannel,
  type Guild,
} from 'discord.js'
import { ensureDiscordClient, getDiscordClient } from '../bot'
import prisma from '@/lib/prisma'
import { PUG_LOBBY_VOICE_CHANNEL_ID, PUG_VOICE_STAFF_ROLE_IDS, VOICE_CLEANUP_TIMEOUT_MS } from '@/pug/constants'

export async function createMatchVoiceChannels(
  lobbyNumber: number,
  team1UserIds: string[],
  team2UserIds: string[],
): Promise<{ team1ChannelId: string; team2ChannelId: string }> {
  const client = await ensureDiscordClient()
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
    })

    await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false })
    // Staff roles (Event Managers) can join either team channel and move players around.
    for (const roleId of PUG_VOICE_STAFF_ROLE_IDS) {
      try {
        await channel.permissionOverwrites.edit(roleId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          MoveMembers: true,
        })
      } catch (err) {
        console.warn(`[PUG Voice] Could not set perms for staff role ${roleId}:`, err)
      }
    }
    for (const userId of allowedUserIds) {
      if (!/^\d{17,20}$/.test(userId)) continue
      try {
        await channel.permissionOverwrites.edit(userId, { Connect: true, Speak: true })
      } catch (err) {
        console.warn(`[PUG Voice] Could not set perms for user ${userId}:`, err)
      }
    }

    return channel.id
  }

  let team1ChannelId = ''
  try {
    team1ChannelId = await createChannel(`PUG #${lobbyNumber} - Team 1`, team1UserIds)
    const team2ChannelId = await createChannel(`PUG #${lobbyNumber} - Team 2`, team2UserIds)
    return { team1ChannelId, team2ChannelId }
  } catch (err) {
    if (team1ChannelId) {
      try {
        const ch = await client.channels.fetch(team1ChannelId)
        if (ch && 'delete' in ch) await (ch as VoiceChannel).delete()
      } catch {
        // already gone
      }
    }
    console.error('[PUG Voice] Failed to create match channels:', err)
    return { team1ChannelId: '', team2ChannelId: '' }
  }
}

/*
 * Moving players in and handing them back.
 *
 * Players already in some voice channel on the server are moved into their team
 * channel when the match starts; nobody is pulled into voice who was not there.
 * Where they came from is saved on the lobby first, so once the match is over
 * anyone still sitting in a team channel goes back there (or to the PUG lobby
 * channel). Anyone who has already left the team channels by then, say during
 * the post-game result vote, is not in them and is never moved again.
 *
 * The channels go once the match is over and they are empty, or ten minutes
 * after the handback regardless, so a post-game chat is not cut short and an
 * abandoned channel does not linger. A sweep does this from the database rather
 * than an in-memory timer, so a deploy mid-match does not orphan the channels.
 */

const FORCE_DELETE_MS = 10 * 60 * 1000
const SWEEP_INTERVAL_MS = 15 * 1000

/**
 * How long after the bot connects the sweep refuses to act.
 *
 * Who is in which channel comes from discord.js's voice state cache, which the
 * gateway fills on connect: for the first moments after a restart every channel
 * truthfully reports nobody in it. A sweep in that window would skip the
 * handback and delete channels with people in them, dropping them out of voice,
 * and a deploy is exactly when that would happen.
 */
const SETTLE_MS = 30 * 1000

/** Statuses in which the match is still being played. Any other status with
 *  channels still open means the match is over (or was reset) and its voice ends. */
const PLAYING_STATUSES = ['IN_PROGRESS', 'REPORTING'] as const

type Origins = Record<string, string>

async function pugGuild(): Promise<Guild | null> {
  const client = getDiscordClient()
  const guildId = process.env.DISCORD_GUILD_ID
  if (!client?.isReady() || !guildId) return null
  return (client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null))) as Guild | null
}

function voiceChannelOf(guild: Guild, userId: string): string | null {
  return guild.voiceStates.cache.get(userId)?.channelId ?? null
}

function membersIn(guild: Guild, channelId: string): string[] {
  return [...guild.voiceStates.cache.filter((vs) => vs.channelId === channelId).keys()]
}

async function moveMember(guild: Guild, userId: string, channelId: string): Promise<void> {
  await guild.members.edit(userId, { channel: channelId })
}

/**
 * Move each team's players who are in voice into their team channel, and return
 * where they came from. `previous` covers a lobby that was reset and restarted
 * while its old channels were still open: someone sitting in an old team channel
 * keeps the origin they had, not the channel that is about to be deleted.
 */
export async function moveTeamsIntoVoice(
  teams: { channelId: string; userIds: string[] }[],
  previous: { origins: Origins; channelIds: string[] } = { origins: {}, channelIds: [] },
): Promise<Origins> {
  const guild = await pugGuild()
  if (!guild) return {}
  const origins: Origins = {}
  for (const team of teams) {
    if (!team.channelId) continue
    for (const userId of team.userIds) {
      const from = voiceChannelOf(guild, userId)
      if (!from || from === team.channelId) continue
      const origin = previous.channelIds.includes(from) ? previous.origins[userId] : from
      // Saved before the move, so the handback knows where to send them.
      if (origin) origins[userId] = origin
      try {
        await moveMember(guild, userId, team.channelId)
      } catch (err) {
        console.error(`[PUG Voice] Moving ${userId} into team voice failed:`, err)
      }
    }
  }
  return origins
}

/**
 * Send everyone still in the given team channels back where they came from,
 * else to the PUG lobby channel. Never throws: a channel that outlives its
 * cleanup is worse than a player who has to rejoin voice by hand.
 */
async function handBack(guild: Guild, channelIds: string[], origins: Origins): Promise<void> {
  const doomed = new Set(channelIds)
  for (const channelId of channelIds) {
    for (const userId of membersIn(guild, channelId)) {
      const origin = origins[userId]
      // An origin inside this match is no help: it is about to go as well.
      const targets = [origin && !doomed.has(origin) ? origin : null, PUG_LOBBY_VOICE_CHANNEL_ID || null]
        .filter((c): c is string => !!c)
      let moved = false
      for (const target of targets) {
        try {
          await moveMember(guild, userId, target)
          moved = true
          break
        } catch (err) {
          console.error(`[PUG Voice] Returning ${userId} to ${target} failed:`, err)
        }
      }
      if (!moved) console.warn(`[PUG Voice] Could not return ${userId} from ${channelId}; they will drop out of voice when it is deleted`)
    }
  }
}

async function channelExists(guild: Guild, channelId: string): Promise<boolean> {
  if (guild.channels.cache.has(channelId)) return true
  return !!(await guild.channels.fetch(channelId).catch(() => null))
}

async function deleteChannel(guild: Guild, channelId: string): Promise<void> {
  const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null))
  if (channel) await channel.delete().catch(() => {})
}

/**
 * Hand back and delete old team channels right away. Used when a lobby starts
 * again while channels from its previous start are still open.
 */
export async function retireMatchVoiceChannels(channelIds: string[], origins: Origins): Promise<void> {
  const guild = await pugGuild()
  if (!guild) return
  const ids = channelIds.filter(Boolean)
  await handBack(guild, ids, origins)
  for (const id of ids) await deleteChannel(guild, id)
}

export async function sweepPugVoice(now = Date.now()): Promise<void> {
  const guild = await pugGuild()
  if (!guild) return
  const readyAt = guild.client.readyTimestamp ?? now
  // Nothing at all, not even the voiceEndedAt stamp: that stamp starts the
  // force-delete clock, and a cold cache would still end up deleting an
  // occupied channel ten minutes later.
  if (now - readyAt < SETTLE_MS) return

  const lobbies = await prisma.pugLobby.findMany({
    where: {
      OR: [{ voiceChannel1Id: { not: null } }, { voiceChannel2Id: { not: null } }],
      AND: [
        {
          OR: [
            { status: { notIn: [...PLAYING_STATUSES] } },
            { voiceEndedAt: { not: null } },
            // A match nobody finished: its channels go after the usual two hours.
            { voiceStartedAt: { lt: new Date(now - VOICE_CLEANUP_TIMEOUT_MS) } },
          ],
        },
      ],
    },
    select: { id: true, lobbyNumber: true, voiceChannel1Id: true, voiceChannel2Id: true, voiceOrigins: true, voiceEndedAt: true },
  })

  for (const lobby of lobbies) {
    try {
      const channelIds = [lobby.voiceChannel1Id, lobby.voiceChannel2Id].filter((c): c is string => !!c)
      const origins = (lobby.voiceOrigins ?? {}) as Origins
      const justEnded = !lobby.voiceEndedAt
      const endedAt = lobby.voiceEndedAt?.getTime() ?? now
      if (justEnded) {
        await prisma.pugLobby.update({ where: { id: lobby.id }, data: { voiceEndedAt: new Date(now) } })
        // The match is over, so the teams go back now rather than whenever the
        // channels happen to be cleaned up.
        await handBack(guild, channelIds, origins)
      }

      const live = []
      for (const id of channelIds) if (await channelExists(guild, id)) live.push(id)
      const empty = live.every((id) => membersIn(guild, id).length === 0)
      const overdue = now - endedAt >= FORCE_DELETE_MS
      if (!empty && !overdue) continue
      // Not redundant with the handback above: someone can rejoin a channel in
      // the window before it is deleted.
      if (!empty) await handBack(guild, live, origins)
      for (const id of live) await deleteChannel(guild, id)
      await prisma.pugLobby.update({
        where: { id: lobby.id },
        data: { voiceChannel1Id: null, voiceChannel2Id: null, voiceOrigins: null as any },
      })
    } catch (err) {
      console.error(`[PUG Voice] Cleaning up voice for PUG #${lobby.lobbyNumber} failed:`, err)
    }
  }
}

let sweepTimer: NodeJS.Timeout | null = null
let sweeping = false
let sweepAgain = false

/** Run a sweep now (e.g. right after a match ends) instead of waiting for the next tick. */
export function sweepPugVoiceSoon(): void {
  if (sweeping) {
    sweepAgain = true
    return
  }
  sweeping = true
  sweepPugVoice()
    .catch((err) => console.error('[PUG Voice] Sweep failed:', err))
    .finally(() => {
      sweeping = false
      if (sweepAgain) {
        sweepAgain = false
        sweepPugVoiceSoon()
      }
    })
}

export function startPugVoiceSweep(): void {
  if (sweepTimer) return
  sweepTimer = setInterval(sweepPugVoiceSoon, SWEEP_INTERVAL_MS)
}

export function stopPugVoiceSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer)
    sweepTimer = null
  }
}
