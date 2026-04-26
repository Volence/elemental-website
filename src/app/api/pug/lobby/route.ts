import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { createOpenLobby } from '@/pug'

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? 'open'

  const lobbies = await prisma.pugLobby.findMany({
    where: {
      tier: tier as any,
      status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
    },
    include: { players: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ lobbies })
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const pugPlayerResult = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })
    const pugPlayer = pugPlayerResult.docs[0] as any
    if (!pugPlayer?.tiers?.includes('open')) {
      return NextResponse.json({ error: 'You must register for open tier first' }, { status: 403 })
    }

    const body = await request.json()
    const { payloadSeasonId } = body
    if (!payloadSeasonId) return NextResponse.json({ error: 'payloadSeasonId required' }, { status: 400 })

    const lobby = await createOpenLobby(user.id, payloadSeasonId)
    return NextResponse.json({ lobby }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
