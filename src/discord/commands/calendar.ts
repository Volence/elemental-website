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
    
    // Fetch upcoming events (next 30 days, publishToDiscord enabled)
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    
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
          { dateStart: { less_than: thirtyDaysFromNow.toISOString() } },
        ],
      },
      sort: 'dateStart',
      limit: 15,
    })
    
    // Fetch broadcast matches (those marked for schedule, like on the website)
    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: now.toISOString() } },
          { date: { less_than: thirtyDaysFromNow.toISOString() } },
          { 'productionWorkflow.includeInSchedule': { equals: true } },
          { status: { not_equals: 'complete' } },
        ],
      },
      sort: 'date',
      limit: 15,
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
    
    // Combine and sort all events by date
    const allEvents = [
      ...events.docs.map((e: any) => ({ ...e, sortDate: new Date(e.dateStart) })),
      ...matchEvents.map((m: any) => ({ ...m, sortDate: new Date(m.dateStart) })),
    ].sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    
    if (allEvents.length === 0) {
      await interaction.editReply({
        content: '📅 No upcoming events scheduled for the next 30 days.',
      })
      return
    }
    
    // Build embed content
    let description = ''
    
    for (const event of allEvents) {
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
      .setTitle('📅 Upcoming Events')
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

/**
 * Update the auto-updating calendar message in a designated channel
 * This edits existing messages rather than posting new ones
 */
export async function updateCalendarChannel(): Promise<void> {
  const channelId = process.env.DISCORD_CALENDAR_CHANNEL_ID || '1442545728223449180'
  
  console.log(`[Calendar] Updating calendar channel: ${channelId}`)
  
  try {
    const { ensureDiscordClient } = await import('../bot')
    const client = await ensureDiscordClient()
    if (!client) {
      console.log('[Calendar] Discord client not available')
      return
    }
    
    const channel = await client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased()) {
      console.log('[Calendar] Invalid calendar channel')
      return
    }
    
    const payload = await getPayload({ config: configPromise })
    
    // Fetch upcoming events
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    
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
          { dateStart: { less_than: thirtyDaysFromNow.toISOString() } },
        ],
      },
      sort: 'dateStart',
      limit: 20,
    })
    
    // Fetch broadcast matches (those marked for schedule, like on the website)
    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: now.toISOString() } },
          { date: { less_than: thirtyDaysFromNow.toISOString() } },
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
    
    // Combine and sort all events by date
    const allEvents = [
      ...events.docs.map((e: any) => ({ ...e, sortDate: new Date(e.dateStart) })),
      ...matchEvents.map((m: any) => ({ ...m, sortDate: new Date(m.dateStart) })),
    ].sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    
    // Build embed content
    let description = allEvents.length === 0 
      ? '*No upcoming events scheduled.*'
      : ''
    
    for (const event of allEvents) {
      // Check if this is a match or a calendar event
      const isMatch = event.eventType === 'match'
      
      // Get emoji
      let emoji = '📅'
      if (isMatch) {
        emoji = '📺' // TV emoji for broadcast matches
      } else {
        emoji = EVENT_TYPE_EMOJI[event.eventType] || '📅'
        if (event.eventType === 'internal' && event.internalEventType) {
          emoji = INTERNAL_TYPE_EMOJI[event.internalEventType] || emoji
        }
      }
      
      const regionBadge = event.region && event.region !== 'global' 
        ? ` **[${event.region.toUpperCase()}]**` 
        : ''
      
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
      
      description += `${emoji} **${event.title}**${regionBadge}${leagueInfo}\n`
      description += `   📆 ${dateStr}\n`
      if (linksStr) {
        description += `   🔗 ${linksStr}\n`
      }
      description += '\n'
    }
    
    const { EmbedBuilder } = await import('discord.js')
    const embed = new EmbedBuilder()
      .setTitle('📅 Upcoming Events')
      .setDescription(description.trim())
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
    
    // Try to find and edit existing bot message, or create new one
    const textChannel = channel as import('discord.js').TextChannel
    const messages = await textChannel.messages.fetch({ limit: 10 })
    const botMessage = messages.find(
      m => m.author.id === client.user?.id && m.embeds.some(e => e.title === '📅 Upcoming Events')
    )
    
    if (botMessage) {
      await botMessage.edit({ embeds: [embed] })
      console.log('[Calendar] Updated existing calendar message')
    } else {
      await textChannel.send({ embeds: [embed] })
      console.log('[Calendar] Created new calendar message')
    }
    
  } catch (error) {
    console.error('[Calendar] Error updating calendar channel:', error)
  }
}
