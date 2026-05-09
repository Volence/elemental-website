import { getDiscordClient } from '../bot'
import { EmbedBuilder } from 'discord.js'
import type { TextChannel } from 'discord.js'
import { getStreams } from '../utils/twitchAuth'
import { serviceHealth } from '../serviceHealth'

let liveRosterInterval: NodeJS.Timeout | null = null
let isRunning = false

const POLL_INTERVAL_MS = 3 * 60 * 1000
const POLL_TIMEOUT_MS = 2 * 60 * 1000

const rosterMessageIds: Record<string, string | null> = {
  'content-creator': null,
  'player': null,
}

export function startTwitchLiveRoster(): void {
  if (liveRosterInterval) return

  console.log('[Twitch] Starting live roster service')

  setTimeout(() => {
    runLiveRosterCheck().catch(console.error)
  }, 60000)

  liveRosterInterval = setInterval(() => {
    if (isRunning) {
      console.warn('[Twitch] Previous poll still running, skipping')
      serviceHealth.record('twitch-roster', false, 'skipped - previous run still active')
      return
    }
    runLiveRosterCheck().catch(err => console.error('[Twitch] Unhandled poll error:', err))
  }, POLL_INTERVAL_MS)
}

export function stopTwitchLiveRoster(): void {
  if (liveRosterInterval) {
    clearInterval(liveRosterInterval)
    liveRosterInterval = null
    console.log('🔴 Stopped Twitch live roster service')
  }
}

/**
 * Manually trigger a live roster check
 */
export async function triggerLiveRosterCheck(): Promise<{ live: number; total: number }> {
  return runLiveRosterCheck()
}

function getChannelForCategory(category: string): string | null {
  if (category === 'player') {
    return process.env.DISCORD_LIVE_ROSTER_PLAYERS_CHANNEL || null
  }
  // Default to creators channel
  return process.env.DISCORD_LIVE_ROSTER_CREATORS_CHANNEL || null
}

async function runLiveRosterCheck(): Promise<{ live: number; total: number }> {
  const start = Date.now()
  isRunning = true
  try {
    const result = await Promise.race([
      _runLiveRosterCheck(start),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Poll timed out')), POLL_TIMEOUT_MS),
      ),
    ])
    return result
  } catch (error) {
    const durationMs = Date.now() - start
    console.error(`[Twitch] Poll failed after ${durationMs}ms:`, error)
    serviceHealth.record('twitch-roster', false, (error as Error).message, durationMs)
    return { live: 0, total: 0 }
  } finally {
    isRunning = false
  }
}

async function _runLiveRosterCheck(start: number): Promise<{ live: number; total: number }> {
  try {
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    const streamers = await payload.find({
      collection: 'twitch-streamers' as any,
      where: { active: { equals: true } },
      limit: 100,
      depth: 2,
    })

    if (streamers.docs.length === 0) {
      updateDiscordEmbeds({})
      return { live: 0, total: 0 }
    }

    const usernames = streamers.docs.map((doc: any) => doc.twitchUsername as string)

    const liveStreams = await getStreams(usernames)
    const liveMap = new Map<string, any>()
    for (const stream of liveStreams) {
      liveMap.set(stream.user_login.toLowerCase(), stream)
    }

    const teamNameCache = new Map<string, string>()
    for (const doc of streamers.docs) {
      const streamer = doc as any
      if (streamer.person && typeof streamer.person === 'object' && streamer.person.id) {
        const personId = streamer.person.id
        if (!teamNameCache.has(personId)) {
          try {
            const teamName = await getTeamNameForPerson(payload, personId)
            if (teamName) teamNameCache.set(personId, teamName)
          } catch {
            // Ignore team lookup errors
          }
        }
      }
    }

    const liveByCategory: Record<string, any[]> = {
      'content-creator': [],
      'player': [],
    }

    for (const doc of streamers.docs) {
      const streamer = doc as any
      const username = (streamer.twitchUsername as string).toLowerCase()
      const category = (streamer.category as string) || 'content-creator'
      const stream = liveMap.get(username)

      let teamName: string | null = null
      if (streamer.person && typeof streamer.person === 'object') {
        teamName = teamNameCache.get(streamer.person.id) || null
      }

      if (stream) {
        const liveData = {
          ...streamer,
          teamName,
          currentStreamTitle: stream.title,
          currentGame: stream.game_name,
          viewerCount: stream.viewer_count,
          thumbnailUrl: stream.thumbnail_url
            ?.replace('{width}', '440')
            ?.replace('{height}', '248'),
          streamStartedAt: stream.started_at,
        }

        if (liveByCategory[category]) {
          liveByCategory[category].push(liveData)
        }

        try {
          await payload.update({
            collection: 'twitch-streamers' as any,
            id: doc.id,
            data: {
              isLive: true,
              currentStreamTitle: stream.title,
              currentGame: stream.game_name,
              viewerCount: stream.viewer_count,
              thumbnailUrl: stream.thumbnail_url
                ?.replace('{width}', '440')
                ?.replace('{height}', '248'),
              streamStartedAt: stream.started_at,
            } as any,
          })
        } catch (err) {
          console.error(`[Twitch] Failed to update live status for ${username}:`, err)
        }
      } else {
        if (streamer.isLive) {
          try {
            await payload.update({
              collection: 'twitch-streamers' as any,
              id: doc.id,
              data: {
                isLive: false,
                currentStreamTitle: null,
                currentGame: null,
                viewerCount: null,
                thumbnailUrl: null,
                streamStartedAt: null,
              } as any,
            })
          } catch (err) {
            console.error(`[Twitch] Failed to update offline status for ${username}:`, err)
          }
        }
      }
    }

    let totalLive = 0
    for (const category of ['content-creator', 'player'] as const) {
      const liveStreamers = liveByCategory[category] || []
      liveStreamers.sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0))
      totalLive += liveStreamers.length
    }

    updateDiscordEmbeds(liveByCategory)

    const durationMs = Date.now() - start
    console.log(`[Twitch] Poll complete: ${totalLive}/${streamers.docs.length} live (${durationMs}ms)`)
    serviceHealth.record('twitch-roster', true, `${totalLive}/${streamers.docs.length} live`, durationMs)
    return { live: totalLive, total: streamers.docs.length }
  } catch (error) {
    const durationMs = Date.now() - start
    console.error(`[Twitch] Live roster check error (${durationMs}ms):`, error)
    serviceHealth.record('twitch-roster', false, (error as Error).message, durationMs)
    return { live: 0, total: 0 }
  }
}

function updateDiscordEmbeds(liveByCategory: Record<string, any[]>): void {
  const client = getDiscordClient()
  if (!client) {
    console.warn('[Twitch] Discord client not available, skipping embed updates')
    return
  }

  const creatorsChannel = process.env.DISCORD_LIVE_ROSTER_CREATORS_CHANNEL
  const playersChannel = process.env.DISCORD_LIVE_ROSTER_PLAYERS_CHANNEL
  if (!creatorsChannel && !playersChannel) return

  for (const category of ['content-creator', 'player'] as const) {
    const channelId = getChannelForCategory(category)
    if (!channelId) continue
    const liveStreamers = liveByCategory[category] || []
    updateRosterMessage(client, channelId, liveStreamers, category).catch(err =>
      console.error(`[Twitch] Failed to update ${category} embed:`, err),
    )
  }
}

/**
 * Look up which team a Person belongs to (first active team found)
 */
async function getTeamNameForPerson(payload: any, personId: string | number): Promise<string | null> {
  try {
    const teams = await payload.find({
      collection: 'teams',
      where: {
        or: [
          { 'roster.starters.person': { equals: personId } },
          { 'roster.substitutes.person': { equals: personId } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (teams.docs.length > 0) {
      return teams.docs[0].name || null
    }
  } catch {
    // Ignore lookup failures
  }
  return null
}

/**
 * Update or create the roster message in a channel.
 * Uses individual embeds per live streamer (up to 10 per message).
 */
async function updateRosterMessage(
  client: any,
  channelId: string,
  liveStreamers: any[],
  category: string,
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId) as TextChannel
    if (!channel?.isTextBased()) return

    // Build embeds - individual cards per streamer, or offline card
    const embeds = liveStreamers.length > 0
      ? buildStreamerEmbeds(liveStreamers, category)
      : [buildOfflineEmbed(category)]

    // Try to load the persistent message ID from memory
    const messageId = rosterMessageIds[category]

    if (messageId) {
      try {
        const message = await channel.messages.fetch(messageId)
        await message.edit({ embeds })
        return
      } catch {
        rosterMessageIds[category] = null
      }
    }

    // If no stored message, look for an existing bot message in the channel
    if (!rosterMessageIds[category]) {
      const messages = await channel.messages.fetch({ limit: 10 })
      const botMessage = messages.find((m: any) => m.author.id === client.user?.id)
      if (botMessage) {
        rosterMessageIds[category] = botMessage.id
        try {
          await botMessage.edit({ embeds })
          return
        } catch {
          rosterMessageIds[category] = null
        }
      }
    }

    // Post a new persistent message
    const message = await channel.send({ embeds })
    rosterMessageIds[category] = message.id
  } catch (error) {
    console.error(`[Twitch] Error updating ${category} roster message:`, error)
  }
}

/**
 * Build individual embed cards for each live streamer.
 * Top 8 get individual cards; if >8, the 9th embed is a summary of the rest.
 * This keeps us within Discord's 10-embed-per-message limit.
 */
function buildStreamerEmbeds(liveStreamers: any[], category: string): EmbedBuilder[] {
  const isPlayers = category === 'player'
  const accentColor = isPlayers ? 0x3B82F6 : 0x9146FF // Blue for players, Purple for creators

  // Split into featured (individual cards) and overflow (summary)
  const MAX_INDIVIDUAL = liveStreamers.length > 9 ? 8 : liveStreamers.length
  const featured = liveStreamers.slice(0, MAX_INDIVIDUAL)
  const overflow = liveStreamers.slice(MAX_INDIVIDUAL)

  const embeds: EmbedBuilder[] = featured.map((streamer) => {
    const username = streamer.twitchUsername || streamer.displayName
    // Name priority: Person name > displayName > twitchUsername
    const personName = streamer.person && typeof streamer.person === 'object' ? streamer.person.name : null
    const displayName = personName || streamer.displayName || streamer.twitchUsername
    const game = streamer.currentGame || 'Just Chatting'
    const viewers = streamer.viewerCount || 0
    const title = streamer.currentStreamTitle || 'Untitled Stream'
    const bio = streamer.bio || null
    const teamName = streamer.teamName || null

    // Stream duration
    let duration = ''
    if (streamer.streamStartedAt) {
      const started = new Date(streamer.streamStartedAt).getTime()
      const elapsed = Date.now() - started
      const hours = Math.floor(elapsed / 3600000)
      const minutes = Math.floor((elapsed % 3600000) / 60000)
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }

    // Build subtitle line (bio, team, or both)
    const subtitleParts: string[] = []
    if (bio) subtitleParts.push(bio)
    if (teamName) subtitleParts.push(`🛡️ ${teamName}`)
    const subtitle = subtitleParts.length > 0 ? `*${subtitleParts.join(' • ')}*` : ''

    const embed = new EmbedBuilder()
      .setColor(accentColor)
      .setAuthor({
        name: `🔴 ${displayName} is live!`,
        url: `https://twitch.tv/${username}`,
        iconURL: streamer.profileImageUrl || undefined,
      })
      .setURL(`https://twitch.tv/${username}`)
      .setTitle(title.length > 256 ? title.substring(0, 253) + '...' : title)

    // Description: subtitle + stats
    const descLines: string[] = []
    if (subtitle) descLines.push(subtitle)
    descLines.push(`🎮 ${game} • 👁 ${viewers.toLocaleString()} viewers${duration ? ` • ⏱ ${duration}` : ''}`)
    embed.setDescription(descLines.join('\n'))

    // Stream preview thumbnail
    if (streamer.thumbnailUrl) {
      embed.setImage(streamer.thumbnailUrl)
    }

    return embed
  })

  // Build overflow summary embed if there are more streamers
  if (overflow.length > 0) {
    const overflowLines = overflow.map((s: any) => {
      const personName = s.person && typeof s.person === 'object' ? s.person.name : null
      const name = personName || s.displayName || s.twitchUsername
      const game = s.currentGame || 'Just Chatting'
      const viewers = s.viewerCount || 0
      return `**[${name}](https://twitch.tv/${s.twitchUsername})** - ${game} • 👁 ${viewers.toLocaleString()}`
    })

    const overflowEmbed = new EmbedBuilder()
      .setColor(accentColor)
      .setTitle(`➕ ${overflow.length} more ${isPlayers ? 'player' : 'creator'}${overflow.length !== 1 ? 's' : ''} also live`)
      .setDescription(overflowLines.join('\n'))

    embeds.push(overflowEmbed)
  }

  // Footer on the last embed
  const lastEmbed = embeds[embeds.length - 1]
  const totalLabel = isPlayers ? 'player' : 'creator'
  lastEmbed.setTimestamp()
  lastEmbed.setFooter({ text: `${liveStreamers.length} ${totalLabel}${liveStreamers.length !== 1 ? 's' : ''} live • Updated` })

  return embeds
}

/**
 * Build a polished "no one is live" embed
 */
function buildOfflineEmbed(category: string): EmbedBuilder {
  const isPlayers = category === 'player'

  return new EmbedBuilder()
    .setColor(0x2B2D31) // Discord dark background color
    .setTitle(isPlayers ? '🎮 Players Currently Live' : '🎥 Content Creators Live')
    .setDescription(
      isPlayers
        ? '*No players are live right now.*\n\nCheck back later to see who\'s streaming! 💤'
        : '*No content creators are live right now.*\n\nCheck back later to see who\'s streaming! 💤'
    )
    .setTimestamp()
    .setFooter({ text: 'Updated' })
}
