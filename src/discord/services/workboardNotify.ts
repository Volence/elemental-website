import type { Payload } from 'payload'
import { ensureDiscordClient } from '@/discord/bot'
import { DEPT_NAMES } from '@/components/WorkboardKanban/constants'
import { formatDueDateTime } from '@/utilities/taskDueDate'

/**
 * Cross-department request notifications.
 *
 * Each department can have a Discord channel on the primary server row
 * (discord-servers.workboardChannels.<department>). When a request is created
 * the target department's channel is pinged; when a request is completed the
 * requesting department's channel is. Silent when no channel is configured, so
 * this is inert until someone fills the settings in.
 */

type TaskLike = {
  id: number | string
  title?: string | null
  department?: string | null
  isRequest?: boolean | null
  requestedByDepartment?: string | null
  dueDate?: string | null
  priority?: string | null
  status?: string | null
}

const BOARD_URLS: Record<string, string> = {
  graphics: '/admin/collections/graphics-anchor',
  video: '/admin/collections/video-anchor',
  events: '/admin/collections/events-anchor',
  'social-media': '/admin/globals/social-media-settings?tab=workboard',
  production: '/admin/globals/production-dashboard?tab=workboard',
}

export function taskBoardUrl(task: TaskLike): string {
  const base = process.env.NEXT_PUBLIC_SERVER_URL || ''
  const board = task.department ? BOARD_URLS[task.department] : undefined
  return board
    ? `${base}${board}${board.includes('?') ? '&' : '?'}task=${task.id}`
    : `${base}/admin/collections/tasks/${task.id}`
}

export function departmentLabel(dept: string | null | undefined): string {
  return (dept && DEPT_NAMES[dept]) || dept || 'Unknown department'
}

export function buildRequestCreatedMessage(task: TaskLike): string {
  const due = task.dueDate ? ` Due ${formatDueDateTime(task.dueDate)}.` : ''
  const priority = task.priority && task.priority !== 'medium' ? ` Priority: ${task.priority}.` : ''
  return `New request from **${departmentLabel(task.requestedByDepartment)}** for ${departmentLabel(task.department)}: **${task.title ?? 'Untitled'}**.${due}${priority} ${taskBoardUrl(task)}`
}

export function buildRequestCompletedMessage(task: TaskLike): string {
  return `**${departmentLabel(task.department)}** completed your request: **${task.title ?? 'Untitled'}**. ${taskBoardUrl(task)}`
}

async function channelForDepartment(payload: Payload, department: string | null | undefined): Promise<string | null> {
  if (!department) return null
  const servers = await payload.find({
    collection: 'discord-servers',
    where: { active: { equals: true } },
    sort: '-isPrimary',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const row = servers.docs[0] as any
  const channels = row?.workboardChannels ?? {}
  const key = department === 'social-media' ? 'socialMedia' : department
  return channels[key] || channels.fallback || null
}

async function post(payload: Payload, department: string | null | undefined, content: string): Promise<boolean> {
  try {
    const channelId = await channelForDepartment(payload, department)
    if (!channelId) return false
    const client = await ensureDiscordClient()
    if (!client) return false
    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (!channel || !channel.isTextBased() || !('send' in channel)) return false
    await channel.send({ content, allowedMentions: { parse: [] } })
    return true
  } catch (err) {
    console.error('[Workboard] notification failed:', err)
    return false
  }
}

/** A request landed on another department's board. */
export async function notifyRequestCreated(payload: Payload, task: TaskLike): Promise<boolean> {
  if (!task.isRequest || !task.requestedByDepartment) return false
  return post(payload, task.department, buildRequestCreatedMessage(task))
}

/** A request someone raised was marked complete. */
export async function notifyRequestCompleted(payload: Payload, task: TaskLike): Promise<boolean> {
  if (!task.isRequest || !task.requestedByDepartment) return false
  return post(payload, task.requestedByDepartment, buildRequestCompletedMessage(task))
}
