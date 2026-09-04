import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildProductionSchedule, postProductionSchedule } from '@/discord/services/productionSchedulePost'

/**
 * Weekly broadcast schedule post.
 *
 * GET  -> preview text for both posts plus whether channels are configured
 *         and what is currently posted.
 * POST -> { mode: 'update' | 'new' } sends or edits the Discord messages.
 *
 * Production managers only (admin or staff-manager).
 */

async function authorize(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return { payload, user: null, response: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) }
  const role = (user as any).role
  if (role !== 'admin' && role !== 'staff-manager') {
    return { payload, user: null, response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) }
  }
  return { payload, user, response: null }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { payload, response } = await authorize(request)
    if (response) return response
    const build = await buildProductionSchedule(payload, 'preview')
    return NextResponse.json({
      staff: build.posts.staff,
      public: build.posts.public,
      matchIds: build.posts.matchIds,
      channels: { staff: !!build.channels.staff, public: !!build.channels.public },
      posted: build.state.staffMessageIds.length > 0 || build.state.publicMessageIds.length > 0
        ? { at: build.state.postedAt, by: build.state.postedBy, matchIds: build.state.matchIds }
        : null,
    })
  } catch (error) {
    console.error('[production/schedule-post] GET error:', error)
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { payload, user, response } = await authorize(request)
    if (response || !user) return response!
    const body = await request.json().catch(() => ({}))
    const mode = body?.mode === 'new' ? 'new' : 'update'
    const result = await postProductionSchedule(payload, {
      mode,
      postedBy: (user as any).name || (user as any).email || `User #${user.id}`,
    })
    payload.logger.info(
      `[production] Broadcast schedule ${result.updated ? 'updated' : 'posted'} (${result.matchCount} matches) by user ${user.id}`,
    )
    return NextResponse.json({ sent: true, ...result })
  } catch (error) {
    console.error('[production/schedule-post] POST error:', error)
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
