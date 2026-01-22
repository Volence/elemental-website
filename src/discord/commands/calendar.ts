import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// Event type emojis
const EVENT_TYPE_EMOJI: Record<string, string> = {
  'faceit': '🏆',
  'owcs': '⚔️',
  'community': '🎉',
  'internal': '🏠',
}

// Internal event type emojis
const INTERNAL_TYPE_EMOJI: Record<string, string> = {
  'seminar': '🎓',
  'pugs': '🎮',
  'internal-tournament': '🏅',
  'other': '📋',
}

// Format a Discord timestamp
function formatDiscordTimestamp(date: Date, style: 'd' | 'D' | 't' | 'T' | 'f' | 'F' | 'R' = 'f'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`
}

// Format date range for display
function formatDateRange(start: Date, end?: Date): string {
  if (!end) {
    return formatDiscordTimestamp(start, 'f')
  }
  
  // Check if same day
  const sameDay = start.toDateString() === end.toDateString()
  if (sameDay) {
    return `${formatDiscordTimestamp(start, 'f')} - ${formatDiscordTimestamp(end, 't')}`
  }
  
  return `${formatDiscordTimestamp(start, 'D')} - ${formatDiscordTimestamp(end, 'D')}`
}

// Build links string
function formatLinks(links: Array<{ label: string | null; url: string | null }> | null | undefined): string {
  if (!links || links.length === 0) return ''
  
  return links
    .filter(link => link.label && link.url)
    .map(link => `[${link.label}](${link.url})`)
    .join(' • ')
}

interface CalendarEvent {
  id: number
  title: string
  eventType: 'faceit' | 'owcs' | 'community' | 'internal'
  internalEventType?: 'seminar' | 'pugs' | 'internal-tournament' | 'other' | null
  region?: 'NA' | 'EU' | 'EMEA' | 'SA' | 'global' | null
  dateStart: string
  dateEnd?: string | null
  links?: Array<{ label: string | null; url: string | null; id?: string | null }> | null
  publishToDiscord?: boolean | null
}

export async function handleCalendar(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()
  
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get the type filter option (default: 'all')
    const filterType = interaction.options.getString('type') || 'all'
    
    // Fetch upcoming events (next 60 days, publishToDiscord enabled)
    const now = new Date()
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    
    // Fetch global calendar events
    const events = await payload.find({
      collection: 'global-calendar-events',
      where: {
        and: [
          { publishToDiscord: { equals: true } },
          {
            or: [
              { dateStart: { greater_than_equal: now.toISOString() } },
              { dateEnd: { greater_than_equal: now.toISOString() } },
            ],
          },
          { dateStart: { less_than: sixtyDaysFromNow.toISOString() } },
        ],
      },
      sort: 'dateStart',
      limit: 50,
    })
    
    // Fetch broadcast matches (those marked for schedule, like on the website)
    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: now.toISOString() } },
          { date: { less_than: sixtyDaysFromNow.toISOString() } },
          { 'productionWorkflow.includeInSchedule': { equals: true } },
          { status: { not_equals: 'complete' } },
        ],
      },
      sort: 'date',
      limit: 20,
      depth: 1,
    })
    
    // Convert matches to calendar event format
    const matchEvents = matches.docs.map((match: any) => ({
      id: match.id,
      title: match.title || `${(match.team as any)?.name || 'TBD'} vs ${match.opponent || 'TBD'}`,
      eventType: 'match' as const,
      dateStart: match.date,
      dateEnd: match.date,
      region: match.region || 'NA',
      league: match.league || 'FACEIT',
      streamUrl: match.stream?.url,
    }))
    
    // Categorize and filter events based on the selected type
    let filteredEvents: any[] = []
    
    if (filterType === 'all') {
      // Combine all events
      filteredEvents = [
        ...events.docs.map((e: any) => ({ ...e, sortDate: new Date(e.dateStart) })),
        ...matchEvents.map((m: any) => ({ ...m, sortDate: new Date(m.dateStart) })),
      ]
    } else if (filterType === 'competitive') {
      // FaceIt + OWCS
      filteredEvents = (events.docs as any[])
        .filter(e => e.eventType === 'faceit' || e.eventType === 'owcs')
        .map((e: any) => ({ ...e, sortDate: new Date(e.dateStart) }))
    } else if (filterType === 'broadcasts') {
      // Streamed matches only
      filteredEvents = matchEvents.map((m: any) => ({ ...m, sortDate: new Date(m.dateStart) }))
    } else if (filterType === 'seminars') {
      // Internal seminars
      filteredEvents = (events.docs as any[])
        .filter(e => e.eventType === 'internal' && e.internalEventType === 'seminar')
        .map((e: any) => ({ ...e, sortDate: new Date(e.dateStart) }))
    } else if (filterType === 'internal') {
      // Internal events (excluding seminars, which have their own category)
      filteredEvents = (events.docs as any[])
        .filter(e => e.eventType === 'internal' && e.internalEventType !== 'seminar')
        .map((e: any) => ({ ...e, sortDate: new Date(e.dateStart) }))
    } else if (filterType === 'community') {
      // Community events
      filteredEvents = (events.docs as any[])
        .filter(e => e.eventType === 'community')
        .map((e: any) => ({ ...e, sortDate: new Date(e.dateStart) }))
    }
    
    // Sort by date
    filteredEvents.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    
    // Get filter name for display
    const filterNames: Record<string, string> = {
      all: 'All Events',
      competitive: 'Competitive Events',
      broadcasts: 'Broadcast Schedule',
      seminars: 'Seminars',
      internal: 'Internal Events',
      community: 'Community Events',
    }
    const filterName = filterNames[filterType] || 'Events'
    
    if (filteredEvents.length === 0) {
      await interaction.editReply({
        content: `📅 No upcoming ${filterName.toLowerCase()} scheduled for the next 60 days.`,
      })
      return
    }
    
    // Build embed content
    let description = ''
    
    for (const event of filteredEvents) {
      // Check if this is a match or a calendar event
      const isMatch = event.eventType === 'match'
      
      // Get emoji based on event type
      let emoji = '📅'
      if (isMatch) {
        emoji = '📺' // TV emoji for broadcast matches
      } else {
        emoji = EVENT_TYPE_EMOJI[event.eventType] || '📅'
        if (event.eventType === 'internal' && event.internalEventType) {
          emoji = INTERNAL_TYPE_EMOJI[event.internalEventType] || emoji
        }
      }
      
      // Region badge
      const regionBadge = event.region && event.region !== 'global' 
        ? ` **[${event.region.toUpperCase()}]**` 
        : ''
      
      // Date formatting
      const dateStart = new Date(event.dateStart)
      const dateEnd = event.dateEnd ? new Date(event.dateEnd) : undefined
      const dateStr = formatDateRange(dateStart, dateEnd)
      
      // Links (for calendar events) or stream (for matches)
      let linksStr = ''
      if (isMatch && event.streamUrl) {
        linksStr = `[Watch Live](${event.streamUrl})`
      } else if (!isMatch && event.links) {
        linksStr = formatLinks(event.links)
      }
      
      // League info for matches
      const leagueInfo = isMatch ? ` • ${event.league}` : ''
      
      // Build event entry
      description += `${emoji} **${event.title}**${regionBadge}${leagueInfo}\n`
      description += `   📆 ${dateStr}\n`
      if (linksStr) {
        description += `   🔗 ${linksStr}\n`
      }
      description += '\n'
    }
    
    // Create embed
    const { EmbedBuilder } = await import('discord.js')
    const embed = new EmbedBuilder()
      .setTitle(`📅 ${filterName}`)
      .setDescription(description.trim())
      .setColor(0x5865F2) // Discord blurple
      .setFooter({ 
        text: `Last updated: ${new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })}` 
      })
    
    await interaction.editReply({
      embeds: [embed],
    })
    
  } catch (error) {
    console.error('[Calendar Command] Error:', error)
    await interaction.editReply({
      content: '❌ Failed to fetch calendar events. Please try again later.',
    })
  }
}

// Category definitions with colors and emojis for the channel calendar
const CALENDAR_CATEGORIES = {
  competitive: {
    title: '⚔️ Competitive Events',
    color: 0xFF9A00, // Gold/Orange
  },
  broadcasts: {
    title: '📺 Broadcast Schedule',
    color: 0x9146FF, // Twitch Purple
  },
  seminars: {
    title: '🎓 Seminars',
    color: 0x5865F2, // Discord Blurple
  },
  internal: {
    title: '🏠 Internal Events',
    color: 0x1ABC9C, // Teal
  },
  community: {
    title: '🎉 Community Events',
    color: 0x57F287, // Green
  },
}

/**
 * Update the auto-updating calendar messages in a designated channel
 * Creates separate color-coded embeds for each category
 */
export async function updateCalendarChannel(): Promise<void> {
  const channelId = process.env.DISCORD_CALENDAR_CHANNEL_ID || '1442545728223449180'
  
  
  try {
    const { ensureDiscordClient } = await import('../bot')
    const client = await ensureDiscordClient()
    if (!client) {
      return
    }
    
    const channel = await client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased()) {
      return
    }
    
    const payload = await getPayload({ config: configPromise })
    
    // Fetch upcoming events (60 days ahead)
    const now = new Date()
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    
    // Fetch global calendar events
    const events = await payload.find({
      collection: 'global-calendar-events',
      where: {
        and: [
          { publishToDiscord: { equals: true } },
          {
            or: [
              { dateStart: { greater_than_equal: now.toISOString() } },
              { dateEnd: { greater_than_equal: now.toISOString() } },
            ],
          },
          { dateStart: { less_than: sixtyDaysFromNow.toISOString() } },
        ],
      },
      sort: 'dateStart',
      limit: 50,
    })
    
    // Fetch broadcast matches
    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: now.toISOString() } },
          { date: { less_than: sixtyDaysFromNow.toISOString() } },
          { 'productionWorkflow.includeInSchedule': { equals: true } },
          { status: { not_equals: 'complete' } },
        ],
      },
      sort: 'date',
      limit: 20,
      depth: 1,
    })
    
    // Convert matches to calendar event format
    const matchEvents = matches.docs.map((match: any) => ({
      id: match.id,
      title: match.title || `${(match.team as any)?.name || 'TBD'} vs ${match.opponent || 'TBD'}`,
      eventType: 'match' as const,
      dateStart: match.date,
      dateEnd: match.date,
      region: match.region || 'NA',
      league: match.league || 'FACEIT',
      streamUrl: match.stream?.url,
    }))
    
    // Categorize events
    const categorizedEvents: Record<string, any[]> = {
      competitive: [],
      broadcasts: [],
      seminars: [],
      internal: [],
      community: [],
    }
    
    // Categorize calendar events
    for (const event of events.docs as any[]) {
      if (event.eventType === 'faceit' || event.eventType === 'owcs') {
        categorizedEvents.competitive.push(event)
      } else if (event.eventType === 'community') {
        categorizedEvents.community.push(event)
      } else if (event.eventType === 'internal') {
        if (event.internalEventType === 'seminar') {
          categorizedEvents.seminars.push(event)
        } else {
          categorizedEvents.internal.push(event)
        }
      }
    }
    
    // Add matches to broadcasts
    categorizedEvents.broadcasts = matchEvents
    
    // Sort each category by date
    for (const key of Object.keys(categorizedEvents)) {
      categorizedEvents[key].sort((a, b) => 
        new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
      )
    }
    
    const { EmbedBuilder } = await import('discord.js')
    const textChannel = channel as import('discord.js').TextChannel
    
    // Build embeds for each category
    const embeds: import('discord.js').EmbedBuilder[] = []
    
    for (const [categoryKey, category] of Object.entries(CALENDAR_CATEGORIES)) {
      const categoryEvents = categorizedEvents[categoryKey]
      
      // Skip empty categories
      if (categoryEvents.length === 0) continue
      
      let description = ''
      
      for (const event of categoryEvents) {
        const isMatch = event.eventType === 'match'
        
        // Region badge
        const regionBadge = event.region && event.region !== 'global' 
          ? ` **[${String(event.region).toUpperCase()}]**` 
          : ''
        
        // Date formatting
        const dateStart = new Date(event.dateStart)
        const dateEnd = event.dateEnd ? new Date(event.dateEnd) : undefined
        const dateStr = formatDateRange(dateStart, dateEnd)
        
        // Links
        let linksStr = ''
        if (isMatch && event.streamUrl) {
          linksStr = `[Watch Live](${event.streamUrl})`
        } else if (!isMatch && event.links) {
          linksStr = formatLinks(event.links)
        }
        
        // League info for matches
        const leagueInfo = isMatch ? ` • ${event.league}` : ''
        
        // Build event entry
        description += `• **${event.title}**${regionBadge}${leagueInfo}\n`
        description += `  📆 ${dateStr}`
        if (linksStr) {
          description += ` • 🔗 ${linksStr}`
        }
        description += '\n'
      }
      
      const embed = new EmbedBuilder()
        .setTitle(category.title)
        .setDescription(description.trim())
        .setColor(category.color)
      
      embeds.push(embed)
    }
    
    // Add a footer to the last embed
    if (embeds.length > 0) {
      embeds[embeds.length - 1].setFooter({
        text: `Last updated: ${new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })}`
      })
    }
    
    // If no events at all, create a single embed
    if (embeds.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('📅 Upcoming Events')
        .setDescription('*No upcoming events scheduled for the next 60 days.*')
        .setColor(0x5865F2)
        .setFooter({
          text: `Last updated: ${new Date().toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })}`
        })
      embeds.push(emptyEmbed)
    }
    
    // Find existing bot message or create new one
    const messages = await textChannel.messages.fetch({ limit: 20 })
    const existingMessage = messages.find(
      m => m.author.id === client.user?.id && m.embeds.length > 0
    )
    
    // Edit existing message or post new one (Discord allows up to 10 embeds per message)
    if (existingMessage) {
      await existingMessage.edit({ embeds })
    } else {
      await textChannel.send({ embeds })
    }
    
  } catch (error) {
    console.error('[Calendar] Error updating calendar channel:', error)
  }
}

