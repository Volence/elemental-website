import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { blockingReferences, removeMergedPerson } from '@/identity/merge'
import { resolveAccess } from '@/access'
import { authError } from '@/utilities/apiAuth'

async function getAdmin() {
  const payload = await getPayload({ config: configPromise })
  const reqHeaders = await headers()
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || !resolveAccess(user as any, []).isAdmin) return { payload: null, user: null }
  return { payload, user }
}

/**
 * The rows past merges left behind. A merge archives its source rather than deleting it, so
 * these accumulate; each one carries what still points at it, since that is what decides
 * whether it can be removed.
 */
export async function GET() {
  try {
    const { payload } = await getAdmin()
    if (!payload) return authError(403, 'Admin required')

    const merged = await payload.find({
      collection: 'people',
      where: { mergedInto: { exists: true } },
      limit: 200,
      depth: 0,
      sort: '-updatedAt',
      overrideAccess: true,
    })

    const tx = (payload as any).db.drizzle
    const rows = []
    for (const doc of merged.docs as any[]) {
      const mergedInto = typeof doc.mergedInto === 'object' ? doc.mergedInto?.id : doc.mergedInto
      if (!mergedInto) continue
      rows.push({
        id: doc.id,
        name: doc.name,
        mergedInto,
        blocking: await blockingReferences(tx, doc.id),
      })
    }

    return NextResponse.json({ rows })
  } catch (err: any) {
    console.error('[Merge People] archived GET error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { payload, user } = await getAdmin()
  if (!payload) return authError(403, 'Admin required')

  const body = await request.json().catch(() => ({}))
  const personId = parseInt(body.id, 10)
  if (!personId) return NextResponse.json({ error: 'A person id is required' }, { status: 400 })

  try {
    const { name } = await removeMergedPerson(payload, { personId, actorId: (user?.id as number) ?? null })
    return NextResponse.json({ success: true, message: `Removed #${personId} (${name})` })
  } catch (err: any) {
    console.error('[Merge People] archived DELETE error:', err)
    // A row that still has references is a normal answer, not a server fault.
    const stillReferenced = /still has references|was not merged/.test(err.message ?? '')
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: stillReferenced ? 409 : 500 })
  }
}
