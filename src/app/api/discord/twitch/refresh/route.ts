import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

export async function POST() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { triggerLiveRosterCheck } = await import('@/discord/services/twitchLiveRoster')
    const result = await triggerLiveRosterCheck()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Twitch API] Error triggering refresh:', error)
    return NextResponse.json({ error: 'Failed to trigger refresh' }, { status: 500 })
  }
}
