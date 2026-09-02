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

// ---------------------------------------------------------------------------
// Sent-digest records (stored as JSON on the Social Media Dashboard global)
// ---------------------------------------------------------------------------

export interface DigestRecord {
  /** Sunday of the week, "YYYY-MM-DD" (local) */
  weekStart: string
  channelId: string
  messageId: string
  sentAt: string
  updatedAt?: string
  /** Closing line used when the digest was sent, reused for automatic edits */
  footer?: string | null
}

const MAX_DIGEST_RECORDS = 26

export function findDigestRecord(records: DigestRecord[] | null | undefined, weekStart: string): DigestRecord | null {
  if (!Array.isArray(records)) return null
  return records.find((r) => r && r.weekStart === weekStart) || null
}

/** Replace the record for the same week (or append), keeping roughly half a year. */
export function upsertDigestRecord(records: DigestRecord[] | null | undefined, record: DigestRecord): DigestRecord[] {
  const base = Array.isArray(records) ? records.filter((r) => r && r.weekStart !== record.weekStart) : []
  base.push(record)
  base.sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
  return base.slice(-MAX_DIGEST_RECORDS)
}

// ---------------------------------------------------------------------------
// Daily "posts due today" ping
// ---------------------------------------------------------------------------

export interface DailyPingOptions {
  /** "YYYY-MM-DD" of the day being pinged (in the team's timezone) */
  dateKey: string
  tasks: DigestTask[]
}

/** Message for the morning-of reminder, or null when nothing is due (no spam). */
export function buildDailyPing({ dateKey, tasks }: DailyPingOptions): string | null {
  const due = tasks
    .filter((t) => t.status !== 'complete' && dueDateKey(t.dueDate) === dateKey)
    .sort((a, b) => a.title.localeCompare(b.title))
  if (due.length === 0) return null

  const [y, m, d] = dateKey.split('-').map(Number)
  const label = new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const lines = [`**Posts due today (${label})**`, '']
  for (const t of due) {
    const who = t.assignees.length > 0 ? t.assignees.map(mention).join(', ') : '_unassigned_'
    lines.push(`- **${t.title}** - ${who}`)
  }
  return lines.join('\n')
}

export interface DailyPingDecision {
  enabled: boolean
  channelId: string | null | undefined
  /** "HH:mm" 24h in the team's timezone */
  time: string
  /** "YYYY-MM-DD" of the last day a ping ran (sent or skipped as empty) */
  lastSentDate: string | null | undefined
  nowLocal: { dateKey: string; hhmm: string }
}

/** True when the ping is on, has a channel, the time has passed, and today has not run yet. */
export function shouldSendDailyPing({ enabled, channelId, time, lastSentDate, nowLocal }: DailyPingDecision): boolean {
  if (!enabled || !channelId) return false
  if (lastSentDate === nowLocal.dateKey) return false
  const target = /^\d{2}:\d{2}$/.test(time) ? time : '09:00'
  return nowLocal.hhmm >= target
}

/** Current wall-clock date/time in an IANA timezone, as sortable strings. */
export function nowInTimezone(timeZone: string, now: Date = new Date()): { dateKey: string; hhmm: string } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(now)
  } catch {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(now)
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00'
  return { dateKey: `${get('year')}-${get('month')}-${get('day')}`, hhmm: `${get('hour')}:${get('minute')}` }
}
