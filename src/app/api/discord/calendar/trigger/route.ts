import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

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
