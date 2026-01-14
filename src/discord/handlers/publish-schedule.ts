import { ensureDiscordClient } from '../bot'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { TextChannel, ThreadChannel } from 'discord.js'

interface PlayerSlot {
  role: string
  playerId: string | null
}

interface DaySchedule {
  date: string
  slots: PlayerSlot[]
  scrim?: {
    opponent: string
    opponentRoster: string
    contact: string
    time: string
    host: 'us' | 'them' | ''
    mapPool: string
    heroBans: boolean
    staggers: boolean
    notes: string
  }
  enabled: boolean
}

interface ScheduleData {
  days: DaySchedule[]
  lastUpdated?: string
}

interface VoteData {
  date: string
  voters: Array<{
    id: string
    username: string
    displayName: string
  }>
}

/**
 * Format a schedule for Discord posting
 */
function formatScheduleMessage(
  schedule: ScheduleData,
  votes: VoteData[] | null,
  pollName: string,
  timeSlot: string,
): string {
  const enabledDays = schedule.days.filter((d) => d.enabled)
  
  if (enabledDays.length === 0) {
    return `📅 **Schedule: ${pollName}**\n\nNo scrim days scheduled this week.`
  }

  // Build player ID → name map from votes
  const playerMap = new Map<string, string>()
  if (votes) {
    for (const day of votes) {
      for (const voter of day.voters) {
        playerMap.set(voter.id, voter.displayName || voter.username)
      }
    }
  }

  let message = `📅 **Schedule: ${pollName}**\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const day of enabledDays) {
    const scrimTime = day.scrim?.time || timeSlot
    
    // === DATE/TIME ===
    message += `**${day.date}** | ${scrimTime}\n\n`
    
    // === OUR ROSTER ===
    message += `**Our Roster:**\n`
    for (const slot of day.slots) {
      const playerName = slot.playerId ? playerMap.get(slot.playerId) || '?' : '—'
      message += `${slot.role}: ${playerName}\n`
    }
    
    // === VS OPPONENT + HOST ===
    if (day.scrim?.opponent) {
      message += `\n🆚 **vs ${day.scrim.opponent}**`
      if (day.scrim.host) {
        message += ` — ${day.scrim.host === 'us' ? 'We host' : 'They host'}`
      }
      message += `\n`
    }

    // === CONTACT ===
    if (day.scrim?.contact) {
      message += `📞 Contact: ${day.scrim.contact}\n`
    }

    // === RULES ===
    const rules: string[] = []
    if (day.scrim?.mapPool) rules.push(`Maps: ${day.scrim.mapPool}`)
    rules.push(`Hero Bans: ${day.scrim?.heroBans ? 'On' : 'Off'}`)
    if (day.scrim?.staggers) rules.push(`Staggers: On`)
    if (rules.length > 0) {
      message += `⚙️ ${rules.join(' • ')}\n`
    }

    // === THEIR ROSTER ===
    if (day.scrim?.opponentRoster) {
      message += `\n**Their Roster:**\n${day.scrim.opponentRoster}\n`
    }

    // === NOTES ===
    if (day.scrim?.notes) {
      message += `\n📝 ${day.scrim.notes}\n`
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  }

  return message.trim()
}

/**
 * Publish schedule to team's Calendar thread
 */
export async function publishScheduleToDiscord(pollId: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure bot is connected (lazy init if needed)
    const client = await ensureDiscordClient()
    if (!client) {
      return { success: false, error: 'Discord bot not connected - check environment variables' }
    }

    const payload = await getPayload({ config })

    // Get the poll with team data
    const poll = await payload.findByID({
      collection: 'discord-polls',
      id: pollId,
      depth: 1, // Populate team
    })

    if (!poll) {
      return { success: false, error: 'Poll not found' }
    }

    const team = poll.team as any
    if (!team || typeof team !== 'object') {
      return { success: false, error: 'Poll has no team linked' }
    }

    const calendarThreadId = team.discordThreads?.calendarThreadId
    if (!calendarThreadId) {
      return { success: false, error: 'Team has no Calendar thread configured' }
    }

    const schedule = poll.schedule as ScheduleData | null
    if (!schedule || !schedule.days || schedule.days.length === 0) {
      return { success: false, error: 'No schedule data to publish' }
    }

    const votes = poll.votes as VoteData[] | null
    const timeSlot = (poll.timeSlot as string) || '8-10 EST'
    const pollName = poll.pollName as string
    const existingMessageId = poll.calendarMessageId as string | null

    // Format the message
    const formattedMessage = formatScheduleMessage(schedule, votes, pollName, timeSlot)

    // Get the thread
    const thread = await client.channels.fetch(calendarThreadId) as TextChannel | ThreadChannel | null
    if (!thread || !('send' in thread)) {
      return { success: false, error: 'Could not find Calendar thread' }
    }

    let messageId = existingMessageId

    // Try to edit existing message, or create new one
    if (existingMessageId) {
      try {
        const existingMessage = await thread.messages.fetch(existingMessageId)
        await existingMessage.edit(formattedMessage)
        console.log(`✅ Updated existing schedule for poll "${pollName}"`)
      } catch (fetchError) {
        // Message was deleted or not found, create a new one
        console.log(`⚠️  Existing message not found, creating new one for "${pollName}"`)
        const newMessage = await thread.send(formattedMessage)
        messageId = newMessage.id
      }
    } else {
      // First publish - create new message
      const newMessage = await thread.send(formattedMessage)
      messageId = newMessage.id
      console.log(`✅ Published new schedule for poll "${pollName}"`)
    }

    // Update poll with message ID and published flag
    await payload.update({
      collection: 'discord-polls',
      id: pollId,
      data: {
        publishedToCalendar: true,
        calendarMessageId: messageId,
      },
    })

    return { success: true }

  } catch (error) {
    console.error('Error publishing schedule:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
