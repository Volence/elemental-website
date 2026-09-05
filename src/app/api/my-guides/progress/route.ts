import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { toggleSectionDone, type GuideProgress } from '@/guides/audience'

/**
 * POST /api/my-guides/progress
 *   { slug, sectionId, done }   tick or untick one section of a guide
 *   { dismissedCard: true }     hide the dashboard "start with your guides" card
 * Always the signed-in person's own row.
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const current = ((user as any).guideProgress ?? null) as GuideProgress | null
  let next: GuideProgress
  if (body.dismissedCard === true) {
    next = { ...(current ?? {}), dismissedCard: true }
  } else if (typeof body.slug === 'string' && typeof body.sectionId === 'string' && typeof body.done === 'boolean') {
    if (!/^[a-z0-9-]+$/.test(body.slug) || body.sectionId.length > 64) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    next = toggleSectionDone(current, body.slug, body.sectionId, body.done)
  } else {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  await payload.update({ collection: 'people', id: user.id, data: { guideProgress: next } as any, overrideAccess: true })
  return NextResponse.json({ progress: next })
}
