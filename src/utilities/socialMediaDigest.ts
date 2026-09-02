import { dueDateKey, localDateKey, addDays } from './taskDueDate'

export interface DigestAssignee {
  name: string
  discordId?: string | null
}

export interface DigestTask {
  title: string
  dueDate: string | null | undefined
  status: string
  assignees: DigestAssignee[]
}

export interface DigestOptions {
  /** Inclusive start of the range (local date). */
  start: Date
  /** Inclusive end of the range (local date). */
  end: Date
  tasks: DigestTask[]
  /** Discord role ID to mention in the header (e.g. the Social Manager role). */
  roleId?: string | null
  /** Optional closing line. */
  footer?: string | null
}

/** "MM.DD" from a "YYYY-MM-DD" key. */
function shortDate(key: string): string {
  return `${key.slice(5, 7)}.${key.slice(8, 10)}`
}

function mention(a: DigestAssignee): string {
  return a.discordId ? `<@${a.discordId}>` : a.name
}

/**
 * Build the weekly schedule message the social media team posts to Discord.
 * Mirrors the hand-written format the team already uses: a bold week header
 * with a role ping, then one bullet per post with the assignee underneath.
 */
export function buildWeeklyDigest({ start, end, tasks, roleId, footer }: DigestOptions): string {
  const startKey = localDateKey(start)
  const endKey = localDateKey(end)

  const header = `**Week from ${shortDate(startKey)} - ${shortDate(endKey)}**${roleId ? ` <@&${roleId}>` : ''}`

  const inRange = tasks
    .map((t) => ({ task: t, key: dueDateKey(t.dueDate) }))
    .filter((x): x is { task: DigestTask; key: string } => !!x.key && x.key >= startKey && x.key <= endKey)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.task.title.localeCompare(b.task.title)))

  const lines: string[] = [header, '']

  if (inRange.length === 0) {
    lines.push('_No posts scheduled this week._')
  } else {
    for (const { task, key } of inRange) {
      const done = task.status === 'complete' ? ' ✅' : ''
      lines.push(`- **${shortDate(key)}: ${task.title}**${done}`)
      const who = task.assignees.length > 0 ? task.assignees.map(mention).join(', ') : '_unassigned_'
      lines.push(` - ${who}`)
      lines.push('')
    }
  }

  if (footer && footer.trim()) {
    if (lines[lines.length - 1] !== '') lines.push('')
    lines.push(footer.trim())
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n'
}

/** Every calendar day key between start and end inclusive (local). */
export function dayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = []
  const endKey = localDateKey(end)
  for (let d = new Date(start); localDateKey(d) <= endKey; d = addDays(d, 1)) {
    keys.push(localDateKey(d))
  }
  return keys
}

/** Discord's per-message content limit. */
export const DISCORD_MESSAGE_MAX = 2000

/** Split a long message on blank lines so each chunk fits Discord's limit. */
export function chunkMessage(rawText: string, max = DISCORD_MESSAGE_MAX): string[] {
  const text = rawText.trim()
  if (text.length <= max) return [text]
  const chunks: string[] = []
  let current = ''
  for (const block of text.split('\n\n')) {
    const candidate = current ? `${current}\n\n${block}` : block
    if (candidate.length > max && current) {
      chunks.push(current)
      current = block
    } else {
      current = candidate
    }
  }
  if (current) chunks.push(current)
  return chunks
}
