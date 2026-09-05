import { NextResponse, type NextRequest } from 'next/server'
import { authenticateWithAccess, requireDepartment } from '@/utilities/apiAuth'

export async function POST(request: NextRequest) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { payload, access } = auth.data
  const deptCheck = requireDepartment(access, 'pug')
  if (deptCheck) return deptCheck

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
