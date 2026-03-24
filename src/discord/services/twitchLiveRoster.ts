import { getDiscordClient } from '../bot'
import { EmbedBuilder } from 'discord.js'
import type { TextChannel } from 'discord.js'
import { getStreams } from '../utils/twitchAuth'

let liveRosterInterval: NodeJS.Timeout | null = null

// Poll every 3 minutes
const POLL_INTERVAL_MS = 3 * 60 * 1000

// Store persistent message IDs per category
const rosterMessageIds: Record<string, string | null> = {
  'content-creator': null,
  'player': null,
}

export function startTwitchLiveRoster(): void {
  if (liveRosterInterval) return

  console.log('🔴 Starting Twitch live roster service')

  // Delay first run to ensure Payload is ready
  setTimeout(() => {
    runLiveRosterCheck().catch(console.error)
  }, 60000) // 60 second delay

  liveRosterInterval = setInterval(() => {
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
  const client = getDiscordClient()
  if (!client) return { live: 0, total: 0 }

  // Check that at least one channel is configured
  const creatorsChannel = process.env.DISCORD_LIVE_ROSTER_CREATORS_CHANNEL
  const playersChannel = process.env.DISCORD_LIVE_ROSTER_PLAYERS_CHANNEL
  if (!creatorsChannel && !playersChannel) {
    console.warn('[Twitch] No live roster channels configured')
    return { live: 0, total: 0 }
  }

  try {
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    // Get all active Twitch streamers (with person relationship populated)
    const streamers = await payload.find({
      collection: 'twitch-streamers' as any,
      where: { active: { equals: true } },
      limit: 100,
      depth: 2, // Populate person -> teams
    })

    if (streamers.docs.length === 0) {
      // No streamers to track — update both embeds to show empty state
      for (const category of ['content-creator', 'player'] as const) {
        const channelId = getChannelForCategory(category)
        if (channelId) {
          await updateRosterMessage(client, channelId, [], category)
        }
      }
      return { live: 0, total: 0 }
    }

    const usernames = streamers.docs.map((doc: any) => doc.twitchUsername as string)

    // Batch-fetch live streams from Twitch API
    const liveStreams = await getStreams(usernames)
    const liveMap = new Map<string, any>()
    for (const stream of liveStreams) {
      liveMap.set(stream.user_login.toLowerCase(), stream)
    }

    // Resolve team names for streamers linked to a Person
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

    // Update each streamer's status and group by category
    const liveByCategory: Record<string, any[]> = {
      'content-creator': [],
      'player': [],
    }

    for (const doc of streamers.docs) {
      const streamer = doc as any
      const username = (streamer.twitchUsername as string).toLowerCase()
      const category = (streamer.category as string) || 'content-creator'
      const stream = liveMap.get(username)

      // Resolve team name from person
      let teamName: string | null = null
      if (streamer.person && typeof streamer.person === 'object') {
        teamName = teamNameCache.get(streamer.person.id) || null
      }

      if (stream) {
        // Streamer is live
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
      } else {
        // Streamer is offline
        if (streamer.isLive) {
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
        }
      }
    }

    // Update roster messages per category
    let totalLive = 0
    for (const category of ['content-creator', 'player'] as const) {
      const channelId = getChannelForCategory(category)
      if (channelId) {
        const liveStreamers = liveByCategory[category] || []
        // Sort by viewers (highest first)
        liveStreamers.sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0))
        totalLive += liveStreamers.length
        await updateRosterMessage(client, channelId, liveStreamers, category)
      }
    }

    console.log(`[Twitch] Poll complete: ${totalLive}/${streamers.docs.length} streamers live`)
    return { live: totalLive, total: streamers.docs.length }
  } catch (error) {
    console.error('[Twitch] Live roster check error:', error)

    // CRITICAL: Even on error, update embeds to show offline state
    try {
      for (const category of ['content-creator', 'player'] as const) {
        const channelId = getChannelForCategory(category)
        if (channelId) {
          await updateRosterMessage(client, channelId, [], category)
        }
      }
    } catch (embedError) {
      console.error('[Twitch] Failed to clear embeds after error:', embedError)
    }

    return { live: 0, total: 0 }
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

    // Build embeds — individual cards per streamer, or offline card
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
      return `**[${name}](https://twitch.tv/${s.twitchUsername})** — ${game} • 👁 ${viewers.toLocaleString()}`
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
