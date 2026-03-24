import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const { triggerLiveRosterCheck } = await import('@/discord/services/twitchLiveRoster')
    const result = await triggerLiveRosterCheck()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Twitch API] Error triggering refresh:', error)
    return NextResponse.json({ error: 'Failed to trigger refresh' }, { status: 500 })
  }
}
