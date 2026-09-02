import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import type { TextChannel, ThreadChannel } from 'discord.js'
import { ensureDiscordClient } from '../bot'
import {
  buildWeeklyDigest,
  chunkMessage,
  findDigestRecord,
  upsertDigestRecord,
  type DigestRecord,
  type DigestTask,
} from '@/utilities/socialMediaDigest'
import { addDays, dueDateKey, localDateKey, weekBoundsFor } from '@/utilities/taskDueDate'

const SETTINGS_SLUG = 'social-media-settings' as const

/** Parse "YYYY-MM-DD" as a local date at noon (safe for day math). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Sunday "YYYY-MM-DD" of the week containing a day key. */
export function weekStartFor(dateKey: string): string {
  return localDateKey(weekBoundsFor(parseDayKey(dateKey)).start)
}

/** Social media tasks with a due date inside [start, end] (calendar days), as digest rows. */
export async function fetchDigestTasks(payload: Payload, start: Date, end: Date): Promise<DigestTask[]> {
  const result = await payload.find({
    collection: 'tasks',
    depth: 1,
    limit: 300,
    sort: 'dueDate',
    overrideAccess: true,
    where: {
      and: [
        { department: { equals: 'social-media' } },
        { archived: { not_equals: true } },
        { dueDate: { greater_than_equal: addDays(start, -1).toISOString() } },
        { dueDate: { less_than_equal: addDays(end, 1).toISOString() } },
      ],
    },
  })
  return result.docs.map((t: any) => ({
    title: t.title,
    dueDate: t.dueDate,
    status: t.status,
    assignees: ((t.assignedTo || []) as any[])
      .filter((a) => a && typeof a === 'object')
      .map((a) => ({ name: a.name || a.email || 'Unknown', discordId: a.discordId || null })),
  }))
}

export interface WeeklyDigestBuild {
  text: string
  taskCount: number
  channelId: string | null
  roleId: string | null
  existing: DigestRecord | null
}

/** Build the digest text for a week plus what we know about where it was last posted. */
export async function buildWeeklyDigestForRange(
  payload: Payload,
  startKey: string,
  endKey: string,
  footer?: string | null,
): Promise<WeeklyDigestBuild> {
  const settings = (await payload.findGlobal({ slug: SETTINGS_SLUG, depth: 0 })) as any
  const channelId: string | null = settings?.digestChannelId || null
  const roleId: string | null = settings?.digestRoleId || null
  const start = parseDayKey(startKey)
  const end = parseDayKey(endKey)
  const tasks = await fetchDigestTasks(payload, start, end)
  const text = buildWeeklyDigest({ start, end, tasks, roleId, footer })
  const taskCount = tasks.filter((t) => {
    const k = dueDateKey(t.dueDate)
    return !!k && k >= startKey && k <= endKey
  }).length
  const existing = findDigestRecord(settings?.digestPosts, startKey)
  return { text, taskCount, channelId, roleId, existing }
}

async function fetchSendableChannel(channelId: string): Promise<TextChannel | ThreadChannel | null> {
  const client = await ensureDiscordClient()
  if (!client) throw new Error('Discord bot is not connected')
  const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | ThreadChannel | null
  if (!channel || !('send' in channel)) return null
  return channel
}

async function saveRecord(payload: Payload, record: DigestRecord): Promise<void> {
  const settings = (await payload.findGlobal({ slug: SETTINGS_SLUG, depth: 0 })) as any
  await payload.updateGlobal({
    slug: SETTINGS_SLUG,
    data: { digestPosts: upsertDigestRecord(settings?.digestPosts, record) },
    overrideAccess: true,
  })
}

export interface PostDigestArgs {
  weekStart: string
  text: string
  footer?: string | null
  /** 'update' edits the message on record for this week; 'new' always sends a fresh message */
  mode: 'update' | 'new'
}

/**
 * Send the weekly digest, or edit the message already posted for that week.
 * Long messages are chunked; only the first chunk is tracked for later edits.
 */
export async function postWeeklyDigest(payload: Payload, { weekStart, text, footer, mode }: PostDigestArgs): Promise<{ updated: boolean; messageId: string }> {
  const settings = (await payload.findGlobal({ slug: SETTINGS_SLUG, depth: 0 })) as any
  const channelId: string | null = settings?.digestChannelId || null
  if (!channelId) throw new Error('No Discord channel configured for the weekly digest')

  const existing = findDigestRecord(settings?.digestPosts, weekStart)
  const chunks = chunkMessage(text.trim())
  const now = new Date().toISOString()

  if (mode === 'update' && existing) {
    const channel = await fetchSendableChannel(existing.channelId)
    const message = channel ? await channel.messages.fetch(existing.messageId).catch(() => null) : null
    if (message) {
      await message.edit({ content: chunks[0], allowedMentions: { parse: ['users', 'roles'] } })
      // Anything beyond the first chunk is appended as new messages (rare).
      for (const extra of chunks.slice(1)) {
        await channel!.send({ content: extra, allowedMentions: { parse: ['users', 'roles'] } })
      }
      await saveRecord(payload, { ...existing, updatedAt: now, footer: footer ?? existing.footer ?? null })
      return { updated: true, messageId: existing.messageId }
    }
    // The old message is gone (deleted by hand?) - fall through and send a new one.
  }

  const channel = await fetchSendableChannel(channelId)
  if (!channel) throw new Error('Could not find the configured Discord channel')
  let firstId: string | null = null
  for (const chunk of chunks) {
    const sent = await channel.send({ content: chunk, allowedMentions: { parse: ['users', 'roles'] } })
    if (!firstId) firstId = sent.id
  }
  await saveRecord(payload, { weekStart, channelId, messageId: firstId!, sentAt: now, footer: footer ?? null })
  return { updated: false, messageId: firstId! }
}

/**
 * Re-render and edit the digest for the week containing `dateKey`, if one was
 * posted. Called from the tasks afterChange hook so reassignments, renames,
 * moves and completions show up in Discord without anyone re-posting.
 */
export async function refreshWeeklyDigestForDate(dateKey: string): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const weekStart = weekStartFor(dateKey)
  const settings = (await payload.findGlobal({ slug: SETTINGS_SLUG, depth: 0 })) as any
  const existing = findDigestRecord(settings?.digestPosts, weekStart)
  if (!existing) return
  const weekEnd = localDateKey(addDays(parseDayKey(weekStart), 6))
  const { text } = await buildWeeklyDigestForRange(payload, weekStart, weekEnd, existing.footer)
  await postWeeklyDigest(payload, { weekStart, text, footer: existing.footer, mode: 'update' })
}
