import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { TextChannel, ThreadChannel } from 'discord.js'
import { ensureDiscordClient } from '@/discord/bot'
import { buildWeeklyDigest, chunkMessage, type DigestTask } from '@/utilities/socialMediaDigest'
import { addDays } from '@/utilities/taskDueDate'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Parse "YYYY-MM-DD" as a local date at noon (safe for day math). */
function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/**
 * POST /api/social-media/weekly-digest
 * Body: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', footer?: string, send?: boolean, text?: string }
 *
 * Without `send`, returns the generated message for preview. With `send: true`,
 * posts `text` (or the generated message) to the configured Discord channel.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const u = user as any
    const allowed = u.role === 'admin' || u.role === 'staff-manager' || u.departments?.isSocialMediaStaff === true
    if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const { start, end, footer, send, text } = body as {
      start?: string
      end?: string
      footer?: string
      send?: boolean
      text?: string
    }
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return NextResponse.json({ message: 'start and end must be YYYY-MM-DD with start <= end' }, { status: 400 })
    }

    const settings = (await payload.findGlobal({ slug: 'social-media-settings', depth: 0 })) as any
    const channelId: string | null = settings?.digestChannelId || null
    const roleId: string | null = settings?.digestRoleId || null

    const startDate = parseDay(start)
    const endDate = parseDay(end)

    // Fetch a day either side; date-only due dates sit at UTC midnight and are
    // bucketed by calendar day inside buildWeeklyDigest.
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
          { dueDate: { greater_than_equal: addDays(startDate, -1).toISOString() } },
          { dueDate: { less_than_equal: addDays(endDate, 1).toISOString() } },
        ],
      },
    })

    const tasks: DigestTask[] = result.docs.map((t: any) => ({
      title: t.title,
      dueDate: t.dueDate,
      status: t.status,
      assignees: ((t.assignedTo || []) as any[])
        .filter((a) => a && typeof a === 'object')
        .map((a) => ({ name: a.name || a.email || 'Unknown', discordId: a.discordId || null })),
    }))

    const generated = buildWeeklyDigest({ start: startDate, end: endDate, tasks, roleId, footer })
    const taskCount = generated.split('\n').filter((l) => l.startsWith('- **')).length

    if (!send) {
      return NextResponse.json({
        text: generated,
        channelConfigured: !!channelId,
        roleConfigured: !!roleId,
        taskCount,
      })
    }

    if (!channelId) {
      return NextResponse.json({ message: 'No Discord channel configured for the weekly digest' }, { status: 400 })
    }

    const message = (typeof text === 'string' && text.trim() ? text : generated).trim()
    if (!message) return NextResponse.json({ message: 'Nothing to send' }, { status: 400 })

    const client = await ensureDiscordClient()
    if (!client) return NextResponse.json({ message: 'Discord bot is not connected' }, { status: 503 })

    const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | ThreadChannel | null
    if (!channel || !('send' in channel)) {
      return NextResponse.json({ message: 'Could not find the configured Discord channel' }, { status: 400 })
    }

    for (const chunk of chunkMessage(message)) {
      await channel.send({ content: chunk, allowedMentions: { parse: ['users', 'roles'] } })
    }

    payload.logger.info(`[social-media] Weekly digest ${start}..${end} posted to ${channelId} by user ${user.id}`)
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('[social-media/weekly-digest] error:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
