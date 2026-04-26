import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? 'open'
  const seasonId = url.searchParams.get('seasonId')
  if (!seasonId) return NextResponse.json({ error: 'seasonId required' }, { status: 400 })

  const entries = await payload.find({
    collection: 'pug-leaderboard',
    where: {
      and: [
        { tier: { equals: tier } },
        { season: { equals: parseInt(seasonId, 10) } },
      ],
    },
    sort: '-rating',
    limit: 100,
    depth: 2,
    overrideAccess: true,
  })

  return NextResponse.json({ entries: entries.docs, total: entries.totalDocs })
}
