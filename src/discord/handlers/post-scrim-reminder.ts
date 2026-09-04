'use server'

import { ensureDiscordClient } from '../bot'
import { getPayload } from 'payload'
import config from '@payload-config'
import { EmbedBuilder, type TextChannel, type ThreadChannel } from 'discord.js'

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

const OPPONENT_ACTIVITIES = new Set<string>(['scrim', 'match', 'warmup'])

/** Title/colour per activity type for the reminder embed */
const ACTIVITY_PRESETS: Record<string, { title: string; color: number }> = {
  scrim: { title: 'Scrim Reminder', color: 0xf59e0b },
  match: { title: 'Match Reminder', color: 0xef4444 },
  warmup: { title: 'Warmup Reminder', color: 0x3b82f6 },
  vod: { title: 'VOD Review Reminder', color: 0x8b5cf6 },
  scouting: { title: 'Scouting Reminder', color: 0x06b6d4 },
  other: { title: 'Session Reminder', color: 0x94a3b8 },
}

/** Mirrors getBlockActivity in the schedule editor: fall back to scrim when legacy data has an opponent */
function resolveActivity(block: TimeBlock): string {
  if (block.activity) return block.activity
  if (block.scrim?.isScrim || block.scrim?.opponent || block.scrim?.opponentTeamId) return 'scrim'
  return 'other'
}

/**
 * Create a Discord embed for a block reminder (scrim, match, warmup, VOD review, ...)
 */
function createBlockEmbed(
  day: DaySchedule,
  block: TimeBlock,
  playerMap: Map<string, string>,
): EmbedBuilder {
  const activity = resolveActivity(block)
  const isOpponentActivity = OPPONENT_ACTIVITIES.has(activity)
  const preset = ACTIVITY_PRESETS[activity] || ACTIVITY_PRESETS.other

  const embed = new EmbedBuilder()
    .setColor(preset.color)
    .setTitle(`${preset.title} \u2022 ${day.date}`)

  // Build a clean description with all key info
  let description = ''

  // Time and opponent
  description += `**${block.time}**`
  if (isOpponentActivity && block.scrim?.opponent) {
    description += ` vs **${block.scrim.opponent}**`
    if (block.scrim.host) {
      description += ` \u2022 ${block.scrim.host === 'us' ? 'We host' : 'They host'}`
    }
  }
  description += '\n'

  // Separator
  description += '\u2500'.repeat(23) + '\n'

  const getIds = (s: PlayerSlot) => s.playerIds?.length ? s.playerIds : s.playerId ? [s.playerId] : []
  // Optional Sub/Coach rows only appear when someone is on them.
  const mainSlots = block.slots.filter(s =>
    !s.isTrial && (!(s.role === 'Sub' || s.role === 'Coach') || getIds(s).length > 0 || (s.isRinger && s.ringerName)),
  )
  const trialSlots = block.slots.filter(s => s.isTrial)

  description += '**Roster**\n'
  for (const slot of mainSlots) {
    let playerName = '-'
    if (slot.isRinger && slot.ringerName) {
      playerName = slot.ringerName === 'Ringer Needed' ? 'Ringer Needed*' : `${slot.ringerName}*`
    } else {
      const ids = getIds(slot)
      if (ids.length > 0) {
        playerName = ids.map(id => playerMap.get(id) || '?').join(', ')
      }
    }
    description += `${slot.role}: ${playerName}\n`
  }

  const filledTrials = trialSlots.filter(s => getIds(s).length > 0)
  if (filledTrials.length > 0) {
    description += '\n**Trials**\n'
    for (const slot of filledTrials) {
      const ids = getIds(slot)
      const playerName = ids.map(id => playerMap.get(id) || '?').join(', ')
      description += `${slot.role}: ${playerName}\n`
    }
  }

  // Match details only make sense against an opponent
  if (isOpponentActivity) {
    description += '\u2500'.repeat(23) + '\n'

    const details: string[] = []
    if (block.scrim?.contact) details.push(`Contact: ${block.scrim.contact}`)
    if (block.scrim?.mapPool) details.push(`Maps: ${block.scrim.mapPool}`)
    details.push(`Hero Bans: ${block.scrim?.heroBans ? 'On' : 'Off'}`)
    details.push(`Staggers: ${block.scrim?.staggers ? 'On' : 'Off'}`)

    description += details.join('\n') + '\n'
  }

  embed.setDescription(description)

  // Their Roster (only if provided, as a separate field)
  if (isOpponentActivity && block.scrim?.opponentRoster) {
    embed.addFields({
      name: 'Their Roster',
      value: block.scrim.opponentRoster.substring(0, 1024),
      inline: false,
    })
  }

  // Notes in footer
  if (block.scrim?.notes) {
    embed.setFooter({ text: block.scrim.notes })
  }

  return embed
}

/**
 * Post a scrim reminder for a specific block to the Schedule thread
 */
export async function postScrimReminder(
  pollId: number,
  dayDate: string,
  blockTime?: string
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
      depth: 2,
      overrideAccess: true,
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

    // Find the specific block (or use first/only block, or migrate legacy data)
    let block: TimeBlock | undefined
    
    if (day.blocks && day.blocks.length > 0) {
      // New format: find block by time, or use first block
      block = blockTime 
        ? day.blocks.find(b => b.time === blockTime) 
        : day.blocks[0]
    } else if (day.slots && day.scrim) {
      // Legacy format: create a virtual block from legacy data
      block = {
        id: 'legacy',
        time: day.scrim.time || '8-10 EST',
        slots: day.slots,
        scrim: {
          opponentTeamId: null,
          opponent: day.scrim.opponent,
          opponentRoster: day.scrim.opponentRoster,
          contact: day.scrim.contact,
          host: day.scrim.host,
          mapPool: day.scrim.mapPool,
          heroBans: day.scrim.heroBans,
          staggers: day.scrim.staggers,
          notes: day.scrim.notes,
        },
      }
    }

    if (!block) {
      return { success: false, error: 'No time block found for this day' }
    }

    // Get Schedule thread ID
    const scheduleThreadId = team?.discordThreads?.scheduleThreadId
    if (!scheduleThreadId) {
      return { success: false, error: 'Schedule thread not configured for this team' }
    }

    // Build player ID -> name map from team roster
    const playerMap = new Map<string, string>()
    const teamData = poll.team as any
    const rosterArrays = [teamData?.roster || [], teamData?.subs || []]
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

    // Supplement from votes
    if (votes) {
      for (const voteDay of votes) {
        for (const voter of voteDay.voters) {
          if (!playerMap.has(voter.id)) {
            playerMap.set(voter.id, voter.displayName || voter.username)
          }
        }
      }
    }

    // Collect IDs still missing and try People lookup
    const allPlayerIds = new Set<string>()
    for (const daySchedule of schedule.days) {
      for (const b of daySchedule.blocks || []) {
        for (const slot of b.slots) {
          if (slot.isRinger) continue
          if (slot.playerIds?.length) {
            for (const id of slot.playerIds) allPlayerIds.add(id)
          } else if (slot.playerId) {
            allPlayerIds.add(slot.playerId)
          }
        }
      }
    }

    const missingIds = Array.from(allPlayerIds).filter(id => !playerMap.has(id))
    if (missingIds.length > 0) {
      try {
        const numericIds = missingIds.filter(id => /^\d+$/.test(id))
        if (numericIds.length > 0) {
          const people = await payload.find({
            collection: 'people',
            where: { id: { in: numericIds.map(id => parseInt(id)) } },
            limit: numericIds.length,
          })
          for (const person of people.docs) {
            playerMap.set(String(person.id), person.name || 'Unknown')
          }
        }
      } catch (e) {
      }
    }

    // Create the embed
    const embed = createBlockEmbed(day, block, playerMap)

    // Fetch the Schedule thread
    const thread = await client.channels.fetch(scheduleThreadId) as TextChannel | ThreadChannel | null
    if (!thread || !('send' in thread)) {
      return { success: false, error: 'Could not find Schedule thread' }
    }

    // Post the reminder as an embed
    await thread.send({ embeds: [embed] })

    return { success: true }
  } catch (error) {
    console.error('Error posting scrim reminder:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
