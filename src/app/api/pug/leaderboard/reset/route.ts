import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { isPugAdmin } from '@/access/roles'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPugAdmin({ req: { user } } as any)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await request.json()
  const { seasonId } = body
  if (!seasonId) return NextResponse.json({ error: 'seasonId required' }, { status: 400 })

  const entries = await payload.find({
    collection: 'pug-leaderboard',
    where: { season: { equals: seasonId } },
    limit: 500,
    overrideAccess: true,
  })

  let count = 0
  for (const entry of entries.docs) {
    await payload.update({
      collection: 'pug-leaderboard',
      id: (entry as any).id,
      data: {
        rating: 1500,
        ratingDeviation: 350,
        volatility: 0.06,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
      },
      overrideAccess: true,
    })
    count++
  }

  return NextResponse.json({ success: true, reset: count })
}
