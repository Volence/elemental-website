import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { nowInTimezone, buildDailyPing } from '@/utilities/socialMediaDigest'
import { fetchDigestTasks, parseDayKey } from '@/discord/services/socialDigest'
import { sendDailyPing } from '@/discord/services/socialDailyPing'

/**
 * POST /api/social-media/daily-ping
 * Body: { send?: boolean }
 * Preview (default) or send today's "posts due today" message right now,
 * regardless of the scheduled time. Admins and staff managers only.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    const u = user as any
    if (u.role !== 'admin' && u.role !== 'staff-manager') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const settings = (await payload.findGlobal({ slug: 'social-media-settings', depth: 0 })) as any
    const { dateKey } = nowInTimezone(settings?.dailyPingTimezone || 'America/New_York')

    if (!body?.send) {
      const day = parseDayKey(dateKey)
      const tasks = await fetchDigestTasks(payload, day, day)
      const text = buildDailyPing({ dateKey, tasks })
      return NextResponse.json({ dateKey, text, channelConfigured: !!settings?.dailyPingChannelId })
    }

    if (!settings?.dailyPingChannelId) {
      return NextResponse.json({ message: 'No Discord channel configured for the daily ping' }, { status: 400 })
    }
    const text = await sendDailyPing(payload, dateKey, settings.dailyPingChannelId)
    return NextResponse.json({ sent: !!text, dateKey, text })
  } catch (error) {
    console.error('[social-media/daily-ping] error:', error)
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
