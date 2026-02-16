import { NextResponse } from 'next/server'

/**
 * Manual Discord Calendar Update Trigger
 * POST /api/discord/calendar/update
 * 
 * Forces an update of the Discord calendar channel.
 * Requires authentication via CRON_SECRET header.
 */
export async function POST(request: Request) {
  try {
    // Authenticate - accept either cron secret or check for Payload auth
    const cronSecret = request.headers.get('x-cron-secret')
    const hasCronAuth = cronSecret && cronSecret === process.env.CRON_SECRET
    
    if (!hasCronAuth) {
      // Also check for Payload session cookie (admin user)
      const cookie = request.headers.get('cookie')
      if (!cookie || !cookie.includes('payload-token')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }
    
    console.log('[Calendar API] Manual calendar update triggered')
    
    const { updateCalendarChannel } = await import('@/discord/commands/calendar')
    await updateCalendarChannel()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Calendar update triggered successfully',
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update calendar' },
      { status: 500 }
    )
  }
}
