import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithAccess } from '@/utilities/apiAuth'
import { withKeyedLock } from '@/utilities/keyedLock'

/**
 * Tick or untick one match for the broadcast schedule, from the Schedule Builder.
 *
 * POST { matchId, include: boolean } -> the match at depth 0.
 *
 * The builder used to PATCH the match with the workflow it loaded when the page opened, which
 * put every signup and assignment list back as it was then, and it reported success without
 * looking at the response. Here the match is read fresh under its lock and only the tick changes.
 * The update runs with the caller's access (production leads and staff).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateWithAccess()
    if (!auth.success) return auth.response
    const { payload, user } = auth.data

    const body = await req.json().catch(() => ({}))
    const matchId = Number(body?.matchId)
    if (!Number.isInteger(matchId) || matchId <= 0 || typeof body?.include !== 'boolean') {
      return NextResponse.json({ message: 'Expected matchId and include' }, { status: 400 })
    }
    const include: boolean = body.include

    const doc = await withKeyedLock(`match:${matchId}`, async () => {
      const match = await payload.findByID({ collection: 'matches', id: matchId, depth: 0, overrideAccess: true })
      const pw = (match as any).productionWorkflow || {}
      const data: Record<string, unknown> = { productionWorkflow: { ...pw, includeInSchedule: include } }
      // Ticking a tournament slot turns it into a confirmed match.
      if (include && (match as any).isTournamentSlot) data.isTournamentSlot = false
      return payload.update({ collection: 'matches', id: matchId, data, user, overrideAccess: false, depth: 0 })
    })

    return NextResponse.json(doc)
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500
    if (status >= 500) console.error('[production/schedule-include] error:', error)
    return NextResponse.json({ message: error?.message || 'Failed to update the schedule' }, { status })
  }
}
