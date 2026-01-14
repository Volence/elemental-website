'use server'

import { ensureDiscordClient } from '../bot'
import { getPayload } from 'payload'
import config from '@payload-config'
import { EmbedBuilder, type TextChannel, type ThreadChannel } from 'discord.js'

interface PlayerSlot {
  role: string
  playerId: string | null
}

interface ScrimDetails {
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

interface DaySchedule {
  date: string
  slots: PlayerSlot[]
  scrim?: ScrimDetails
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
 * Create a Discord embed for a scrim reminder
 */
function createScrimEmbed(
  day: DaySchedule,
  playerMap: Map<string, string>,
  timeSlot: string,
): EmbedBuilder {
  const scrimTime = day.scrim?.time || timeSlot
  
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b) // Amber/orange color
    .setTitle(`Scrim Reminder • ${day.date}`)
  
  // Build a clean description with all key info
  let description = ''
  
  // Time and opponent
  description += `**${scrimTime}**`
  if (day.scrim?.opponent) {
    description += ` vs **${day.scrim.opponent}**`
    if (day.scrim.host) {
      description += ` • ${day.scrim.host === 'us' ? 'We host' : 'They host'}`
    }
  }
  description += '\n'
  
  // Separator
  description += '───────────────────────\n'
  
  // Our roster (simple list)
  description += '**Roster**\n'
  for (const slot of day.slots) {
    const playerName = slot.playerId ? playerMap.get(slot.playerId) || '?' : '—'
    description += `${slot.role}: ${playerName}\n`
  }
  
  // Separator before match details
  description += '───────────────────────\n'
  
  // Match details
  const details: string[] = []
  if (day.scrim?.contact) details.push(`Contact: ${day.scrim.contact}`)
  if (day.scrim?.mapPool) details.push(`Maps: ${day.scrim.mapPool}`)
  details.push(`Hero Bans: ${day.scrim?.heroBans ? 'On' : 'Off'}`)
  details.push(`Staggers: ${day.scrim?.staggers ? 'On' : 'Off'}`)
  
  description += details.join('\n') + '\n'
  
  embed.setDescription(description)
  
  // Their Roster (only if provided, as a separate field)
  if (day.scrim?.opponentRoster) {
    embed.addFields({
      name: 'Their Roster',
      value: day.scrim.opponentRoster.substring(0, 1024),
      inline: false,
    })
  }
  
  // Notes in footer
  if (day.scrim?.notes) {
    embed.setFooter({ text: day.scrim.notes })
  }
  
  return embed
}

/**
 * Post a scrim reminder for a specific day to the Schedule thread
 */
export async function postScrimReminder(
  pollId: number,
  dayDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return { success: false, error: 'Discord bot not connected' }
    }

    const payload = await getPayload({ config })

    // Fetch the poll with its schedule and team
    const poll = await payload.findByID({
      collection: 'discord-polls',
      id: pollId,
      depth: 1,
    })

    if (!poll) {
      return { success: false, error: 'Poll not found' }
    }

    const pollName = poll.pollName as string
    const schedule = poll.schedule as ScheduleData | null
    const votes = poll.votes as VoteData[] | null
    const team = poll.team as { discordThreads?: { scheduleThreadId?: string } } | null

    if (!schedule) {
      return { success: false, error: 'No schedule data found' }
    }

    // Find the specific day
    const day = schedule.days.find((d) => d.date === dayDate)
    if (!day) {
      return { success: false, error: `Day "${dayDate}" not found in schedule` }
    }

    if (!day.enabled) {
      return { success: false, error: 'This day is not enabled' }
    }

    // Get Schedule thread ID
    const scheduleThreadId = team?.discordThreads?.scheduleThreadId
    if (!scheduleThreadId) {
      return { success: false, error: 'Schedule thread not configured for this team' }
    }

    // Build player ID → name map from votes
    const playerMap = new Map<string, string>()
    if (votes) {
      for (const voteDay of votes) {
        for (const voter of voteDay.voters) {
          playerMap.set(voter.id, voter.displayName || voter.username)
        }
      }
    }

    // Get default time slot from team
    const timeSlot = (team as any)?.discordThreads?.defaultTimeSlot || '8-10 EST'

    // Create the embed
    const embed = createScrimEmbed(day, playerMap, timeSlot)

    // Fetch the Schedule thread
    const thread = await client.channels.fetch(scheduleThreadId) as TextChannel | ThreadChannel | null
    if (!thread || !('send' in thread)) {
      return { success: false, error: 'Could not find Schedule thread' }
    }

    // Post the reminder as an embed
    await thread.send({ embeds: [embed] })
    console.log(`✅ Posted scrim reminder for "${dayDate}" in poll "${pollName}"`)

    return { success: true }
  } catch (error) {
    console.error('Error posting scrim reminder:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
