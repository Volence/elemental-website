import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { updateCalendarChannel } = await import('@/discord/commands/calendar')
    await updateCalendarChannel()
    return NextResponse.json({ success: true, message: 'Calendar channel updated' })
  } catch (error) {
    console.error('[Calendar Trigger] Error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
