import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET() {
  const payload = await getPayload({ config: configPromise })
  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { active: { equals: true } },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any
  // Default to enabled (true) when there's no active season or the field is unset.
  const botEnabled = season ? season.botEnabled !== false : true
  return NextResponse.json({ botEnabled })
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { active: { equals: true } },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any
  if (!season) {
    return NextResponse.json({ error: 'No active season' }, { status: 400 })
  }

  // Determine new value: use explicit body.enabled if provided, else flip current
  let newEnabled: boolean
  try {
    const body = await request.json()
    if (typeof body?.enabled === 'boolean') {
      newEnabled = body.enabled
    } else {
      newEnabled = !(season.botEnabled !== false)
    }
  } catch {
    newEnabled = !(season.botEnabled !== false)
  }

  await payload.update({
    collection: 'pug-seasons',
    id: season.id,
    data: { botEnabled: newEnabled },
    overrideAccess: true,
  })

  return NextResponse.json({ botEnabled: newEnabled })
}
