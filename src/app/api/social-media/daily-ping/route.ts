import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithAccess, requireDepartment } from '@/utilities/apiAuth'
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
    const auth = await authenticateWithAccess()
    if (!auth.success) return auth.response
    const { payload, access } = auth.data
    const deptCheck = requireDepartment(access, 'social', 'lead')
    if (deptCheck) return deptCheck

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
