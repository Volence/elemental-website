import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildWeeklyDigestForRange, postWeeklyDigest } from '@/discord/services/socialDigest'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/social-media/weekly-digest
 * Body: { start, end: 'YYYY-MM-DD', footer?, send?: boolean, text?, mode?: 'update' | 'new' }
 *
 * Without `send`, returns the generated message plus whether a Discord message
 * already exists for that week. With `send: true`, edits the existing message
 * (mode 'update', the default when one exists) or posts a new one.
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
    const { start, end, footer, send, text, mode } = body as {
      start?: string
      end?: string
      footer?: string
      send?: boolean
      text?: string
      mode?: 'update' | 'new'
    }
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return NextResponse.json({ message: 'start and end must be YYYY-MM-DD with start <= end' }, { status: 400 })
    }

    const built = await buildWeeklyDigestForRange(payload, start, end, footer)

    if (!send) {
      return NextResponse.json({
        text: built.text,
        channelConfigured: !!built.channelId,
        roleConfigured: !!built.roleId,
        taskCount: built.taskCount,
        existingMessage: built.existing
          ? { messageId: built.existing.messageId, sentAt: built.existing.sentAt, updatedAt: built.existing.updatedAt ?? null }
          : null,
      })
    }

    if (!built.channelId) {
      return NextResponse.json({ message: 'No Discord channel configured for the weekly digest' }, { status: 400 })
    }

    const message = (typeof text === 'string' && text.trim() ? text : built.text).trim()
    if (!message) return NextResponse.json({ message: 'Nothing to send' }, { status: 400 })

    const result = await postWeeklyDigest(payload, {
      weekStart: start,
      text: message,
      footer,
      mode: mode === 'new' ? 'new' : 'update',
    })

    payload.logger.info(
      `[social-media] Weekly digest ${start}..${end} ${result.updated ? 'updated' : 'posted'} (${result.messageId}) by user ${user.id}`,
    )
    return NextResponse.json({ sent: true, updated: result.updated, messageId: result.messageId })
  } catch (error) {
    console.error('[social-media/weekly-digest] error:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
