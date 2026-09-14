import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithAccess } from '@/utilities/apiAuth'
import { withKeyedLock } from '@/utilities/keyedLock'
import { withAssignment, withoutAssignment, type StaffRole } from '@/utilities/productionSignups'

/**
 * Assign or unassign one person on one match, from the Assignment view.
 *
 * POST { matchId, role: 'observer' | 'producer' | 'director' | 'caster', userId, style?, action: 'assign' | 'unassign' }
 * -> the match at depth 2.
 *
 * The view used to PATCH the match with the production workflow it loaded when the page opened,
 * which put back every signup list as it was then and dropped anyone who had signed up since.
 * Here the match is read fresh under its lock and only the one role list changes. The update runs
 * with the caller's access, so the rule is the same as editing the match (production managers).
 */

const ROLES: StaffRole[] = ['observer', 'producer', 'director', 'caster']

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateWithAccess()
    if (!auth.success) return auth.response
    const { payload, user } = auth.data

    const body = await req.json().catch(() => ({}))
    const matchId = Number(body?.matchId)
    const userId = Number(body?.userId)
    const role = body?.role as StaffRole
    const action = body?.action
    if (!Number.isInteger(matchId) || !Number.isInteger(userId) || !ROLES.includes(role) || (action !== 'assign' && action !== 'unassign')) {
      return NextResponse.json({ message: 'Expected matchId, userId, role and action' }, { status: 400 })
    }

    await withKeyedLock(`match:${matchId}`, async () => {
      const match = await payload.findByID({ collection: 'matches', id: matchId, depth: 0, overrideAccess: true })
      const pw = (match as any).productionWorkflow || {}
      const change = action === 'assign'
        ? withAssignment(pw, role, userId, body?.style)
        : withoutAssignment(pw, role, userId)
      await payload.update({
        collection: 'matches',
        id: matchId,
        data: { productionWorkflow: { ...pw, ...change } },
        user,
        overrideAccess: false,
      })
    })

    const doc = await payload.findByID({ collection: 'matches', id: matchId, depth: 2, overrideAccess: true })
    return NextResponse.json(doc)
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500
    if (status >= 500) console.error('[production/assignment] error:', error)
    return NextResponse.json({ message: error?.message || 'Failed to update assignment' }, { status })
  }
}
