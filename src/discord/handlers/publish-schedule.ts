import { ensureDiscordClient } from '../bot'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { TextChannel, ThreadChannel } from 'discord.js'

interface PlayerSlot {
  role: string
  playerId: string | null
  playerIds?: string[]
  isRinger?: boolean
  ringerName?: string
  isTrial?: boolean
}

interface ScrimDetails {
  isScrim?: boolean
  opponentTeamId?: number | null
  opponent: string
  opponentRoster: string
  contact: string
  host: 'us' | 'them' | ''
  mapPool: string
  heroBans: boolean
  staggers: boolean
  notes: string
}

interface TimeBlock {
  id: string
  time: string
  activity?: string
  slots: PlayerSlot[]
  scrim?: ScrimDetails
  reminderPosted?: boolean
}

interface DaySchedule {
  date: string
  enabled: boolean
  useAllMembers?: boolean
  blocks: TimeBlock[]
  // Legacy fields for backward compatibility
  slots?: PlayerSlot[]
  scrim?: ScrimDetails & { time?: string }
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
 * Format a schedule for Discord posting with code blocks per day
 * @param schedule - The schedule data
 * @param playerMap - Pre-built map of player IDs to display names (from votes and/or People records)
 * @param pollName - Name of the poll/schedule
 * @param timeSlot - Default time slot for legacy format
 */
function formatScheduleMessageWithMap(
  schedule: ScheduleData,
  playerMap: Map<string, string>,
  pollName: string,
  timeSlot: string,
): string {
  const enabledDays = schedule.days.filter((d) => d.enabled)

  let message = `📅 **${pollName}**\n`
  let hasAnyScrim = false

  for (const day of enabledDays) {
    // Get blocks - migrate legacy format if needed
    let blocks: TimeBlock[] = []
    
    if (day.blocks && day.blocks.length > 0) {
      blocks = day.blocks
    } else if (day.slots) {
      // Legacy format - create virtual block
      blocks = [{
        id: 'legacy',
        time: day.scrim?.time || timeSlot,
        slots: day.slots,
        scrim: day.scrim ? {
          opponentTeamId: null,
          opponent: day.scrim.opponent,
          opponentRoster: day.scrim.opponentRoster,
          contact: day.scrim.contact,
          host: day.scrim.host,
          mapPool: day.scrim.mapPool,
          heroBans: day.scrim.heroBans,
          staggers: day.scrim.staggers,
          notes: day.scrim.notes,
        } : undefined,
      }]
    }

    blocks = blocks.filter(b => b.activity === 'scrim' || b.activity === 'match' || b.scrim?.isScrim || b.scrim?.opponent || b.scrim?.opponentTeamId)
    if (blocks.length === 0) continue
    hasAnyScrim = true

    // Format each block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      
      // === HEADER (outside code block) ===
      if (blocks.length > 1) {
        message += `\n**${day.date}** • Block ${i + 1} • ${block.time}\n`
      } else {
        message += `\n**${day.date}** • ${block.time}\n`
      }
      
      // === CODE BLOCK START ===
      message += '```\n'
      
      // Status line
      if (block.scrim?.opponent) {
        const hostText = block.scrim.host === 'us' ? 'We host' : block.scrim.host === 'them' ? 'They host' : ''
        message += `🆚 vs ${block.scrim.opponent}${hostText ? ` - ${hostText}` : ''}\n\n`
      } else {
        message += `🔍 Looking for Scrim\n\n`
      }
      
      // === ROSTER (aligned) ===
      const mainSlots = block.slots.filter(s => !s.isTrial)
      const trialSlots = block.slots.filter(s => s.isTrial)
      const getPlayerIds = (s: PlayerSlot) => s.playerIds?.length ? s.playerIds : s.playerId ? [s.playerId] : []
      const filledSlots = mainSlots.filter(s => getPlayerIds(s).length > 0 || (s.isRinger && s.ringerName))
      const totalSlots = mainSlots.length

      const maxRoleLen = Math.max(...mainSlots.map(s => (s.role || 'Role').length), 10)

      for (const slot of mainSlots) {
        let playerName = '-'
        if (slot.isRinger && slot.ringerName) {
          playerName = slot.ringerName === 'Ringer Needed' ? 'Ringer Needed ✦' : `${slot.ringerName} ✦`
        } else {
          const ids = getPlayerIds(slot)
          if (ids.length > 0) {
            playerName = ids.map(id => playerMap.get(id) || '?').join(', ')
          }
        }
        const role = (slot.role || 'Role').padEnd(maxRoleLen)
        message += `${role}  ${playerName}\n`
      }

      const filledTrials = trialSlots.filter(s => getPlayerIds(s).length > 0)
      if (filledTrials.length > 0) {
        message += `\n--- Trials ---\n`
        for (const slot of filledTrials) {
          const ids = getPlayerIds(slot)
          const playerName = ids.map(id => playerMap.get(id) || '?').join(', ')
          const role = (slot.role || 'Role').padEnd(maxRoleLen)
          message += `${role}  ${playerName}\n`
        }
      }

      if (filledSlots.length === totalSlots && totalSlots > 0) {
        message += `\n✓ Roster confirmed\n`
      } else if (filledSlots.length > 0) {
        message += `\n${filledSlots.length}/${totalSlots} slots filled\n`
      }
      
      // === SETTINGS LINE ===
      const settings: string[] = []
      if (block.scrim?.heroBans) settings.push('Hero Bans')
      if (block.scrim?.staggers) settings.push('Staggers')
      if (block.scrim?.mapPool) settings.push(`Maps: ${block.scrim.mapPool}`)
      if (settings.length > 0) {
        message += `⚙️ ${settings.join(' • ')}\n`
      }
      
      // === CONTACT ===
      if (block.scrim?.contact) {
        message += `📞 ${block.scrim.contact}\n`
      }
      
      // === THEIR ROSTER (inside code block) ===
      if (block.scrim?.opponentRoster) {
        message += `\n─── Their Roster ───\n${block.scrim.opponentRoster}\n`
      }

      // === NOTES (inside code block) ===
      if (block.scrim?.notes) {
        message += `\n📝 ${block.scrim.notes}\n`
      }
      
      // === CODE BLOCK END ===
      message += '```'
    }
    
    message += '\n'
  }

  if (!hasAnyScrim) {
    return `📅 **${pollName}**\n\nNo scrims scheduled this week.`
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
      depth: 2,
      overrideAccess: true, // Ensure fresh data
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
    

    // Collect all player IDs from the schedule that need name resolution
    const playerIdsToResolve = new Set<string>()
    for (const day of schedule.days) {
      if (day.blocks) {
        for (const block of day.blocks) {
          for (const slot of block.slots) {
            if (slot.isRinger) continue
            if (slot.playerIds?.length) {
              for (const id of slot.playerIds) playerIdsToResolve.add(id)
            } else if (slot.playerId) {
              playerIdsToResolve.add(slot.playerId)
            }
          }
        }
      }
    }

    // Build player ID -> name map from team roster (People IDs)
    const playerMap = new Map<string, string>()
    const rosterArrays = [team.roster || [], team.subs || []]
    for (const arr of rosterArrays) {
      for (const entry of arr) {
        const person = typeof entry === 'object' && entry.person
          ? (typeof entry.person === 'object' ? entry.person : null)
          : null
        if (person) {
          playerMap.set(String(person.id), person.name || 'Unknown')
          if (person.discordId) {
            playerMap.set(person.discordId, person.name || 'Unknown')
          }
        }
      }
    }

    // Pull from calendar responses (discordId -> username)
    const responses = (poll as any).responses || []
    for (const r of responses) {
      if (r.discordId && r.discordUsername && !playerMap.has(r.discordId)) {
        playerMap.set(r.discordId, r.discordUsername.replace(/^@/, ''))
      }
    }

    // Also add from votes (Discord IDs) for any not covered by roster
    if (votes) {
      for (const day of votes) {
        for (const voter of day.voters) {
          if (!playerMap.has(voter.id)) {
            playerMap.set(voter.id, voter.displayName || voter.username)
          }
        }
      }
    }

    // For any IDs still missing, look them up as People records
    const missingIds = Array.from(playerIdsToResolve).filter(id => !playerMap.has(id))
    if (missingIds.length > 0) {
      try {
        const numericIds = missingIds.filter(id => /^\d+$/.test(id))
        if (numericIds.length > 0) {
          const peopleResult = await payload.find({
            collection: 'people',
            where: {
              id: { in: numericIds.map(id => parseInt(id)) },
            },
            limit: numericIds.length,
          })
          for (const person of peopleResult.docs) {
            playerMap.set(String(person.id), (person as any).name || 'Unknown')
          }
        }
      } catch (e) {
      }
    }

    // Format the message (pass pre-built playerMap)
    const formattedMessage = formatScheduleMessageWithMap(schedule, playerMap, pollName, timeSlot)

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
      } catch (fetchError) {
        // Message was deleted or not found, create a new one
        const newMessage = await thread.send(formattedMessage)
        messageId = newMessage.id
      }
    } else {
      // First publish - create new message
      const newMessage = await thread.send(formattedMessage)
      messageId = newMessage.id
    }

    // Update poll with message ID and published flag
    await payload.update({
      collection: 'discord-polls',
      id: pollId,
      data: {
        publishedToCalendar: true,
        calendarMessageId: messageId,
      },
      overrideAccess: true, // Bypass field validation in server context
    })

    return { success: true }

  } catch (error) {
    console.error('Error publishing schedule:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
