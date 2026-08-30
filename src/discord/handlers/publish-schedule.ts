import { ensureDiscordClient } from '../bot'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Message, TextChannel, ThreadChannel } from 'discord.js'
import { formatScheduleMessages, type ScheduleData } from './schedule-format'

interface VoteData {
  date: string
  voters: Array<{
    id: string
    username: string
    displayName: string
  }>
}

/** Message IDs are stored comma-separated in the single calendarMessageId text field. */
export function parseMessageIds(raw: string | null | undefined): string[] {
  return (raw || '').split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * Bring the thread's set of schedule messages in line with `contents`:
 * edit the ones we already own in order, send extras, delete leftovers.
 * Returns the IDs now backing the post.
 */
export async function syncScheduleMessages(
  thread: TextChannel | ThreadChannel,
  existingIds: string[],
  contents: string[],
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < contents.length; i++) {
    const existingId = existingIds[i]
    let message: Message | null = null
    if (existingId) {
      try {
        const existing = await thread.messages.fetch(existingId)
        message = await existing.edit(contents[i])
      } catch {
        message = null
      }
    }
    if (!message) {
      message = await thread.send(contents[i])
    }
    ids.push(message.id)
  }
  for (const leftover of existingIds.slice(contents.length)) {
    try {
      const msg = await thread.messages.fetch(leftover)
      await msg.delete()
    } catch {
      // already gone
    }
  }
  return ids
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
    const existingIds = parseMessageIds(poll.calendarMessageId as string | null)

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

    // Long weeks do not fit in one Discord message (2000 char cap), so the
    // schedule is split at block boundaries across as many as needed.
    const contents = formatScheduleMessages(schedule, playerMap, pollName, timeSlot)

    const thread = await client.channels.fetch(calendarThreadId) as TextChannel | ThreadChannel | null
    if (!thread || !('send' in thread)) {
      return { success: false, error: 'Could not find Calendar thread' }
    }

    const messageIds = await syncScheduleMessages(thread, existingIds, contents)

    // Update poll with message ID and published flag
    await payload.update({
      collection: 'discord-polls',
      id: pollId,
      data: {
        publishedToCalendar: true,
        calendarMessageId: messageIds.join(','),
      },
      overrideAccess: true, // Bypass field validation in server context
    })

    return { success: true }

  } catch (error) {
    console.error('Error publishing schedule:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
