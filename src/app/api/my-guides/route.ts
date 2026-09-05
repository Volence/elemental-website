import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { guideMatchesViewer } from '@/guides/audience'
import { DEFAULT_GUIDES, installMissingDefaultGuides, restoreDefaultGuide } from '@/guides/defaults'

/**
 * GET  /api/my-guides         guides for the signed-in person (admins: all, incl. unpublished) + their progress
 * POST /api/my-guides         admin only: { action: 'install-missing' } | { action: 'restore', slug }
 */
export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const u = user as any
  const isAdmin = u.role === 'admin'

  // First admin visit on an empty collection seeds the shipped guides.
  let installed: string[] = []
  if (isAdmin) {
    const count = await payload.count({ collection: 'guides' as any, overrideAccess: true })
    if (count.totalDocs === 0) installed = await installMissingDefaultGuides(payload as any, DEFAULT_GUIDES)
  }

  const res = await payload.find({
    collection: 'guides' as any,
    where: isAdmin ? {} : { published: { equals: true } },
    sort: 'order',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  })
  const guides = (res.docs as any[])
    .filter((g) => guideMatchesViewer(g.audience, u))
    .map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      summary: g.summary ?? null,
      order: g.order ?? 100,
      published: g.published !== false,
      // Admins see every guide; "for you" marks the ones that would match them anyway.
      forViewer: isAdmin ? g.audience?.roles?.admin === true || guideMatchesViewer(g.audience, { role: null, departments: u.departments }) : true,
      audience: g.audience ?? null,
      hasDefault: DEFAULT_GUIDES.some((d) => d.slug === g.slug),
      sections: (g.sections ?? []).map((s: any) => ({
        id: s.id,
        heading: s.heading,
        body: s.body ?? null,
        linkLabel: s.linkLabel ?? null,
        linkHref: s.linkHref ?? null,
        imageUrl: s.image && typeof s.image === 'object' ? s.image.url ?? null : null,
      })),
    }))

  return NextResponse.json(
    { guides, progress: u.guideProgress ?? null, isAdmin, installed, missingDefaults: DEFAULT_GUIDES.filter((d) => !res.docs.some((g: any) => g.slug === d.slug)).map((d) => d.slug) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body?.action === 'install-missing') {
    const installed = await installMissingDefaultGuides(payload as any, DEFAULT_GUIDES)
    return NextResponse.json({ installed })
  }
  if (body?.action === 'restore' && typeof body.slug === 'string') {
    const ok = await restoreDefaultGuide(payload as any, DEFAULT_GUIDES, body.slug)
    return ok ? NextResponse.json({ restored: body.slug }) : NextResponse.json({ error: 'No default for that guide' }, { status: 404 })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
