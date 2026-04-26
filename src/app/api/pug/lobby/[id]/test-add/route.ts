import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { joinLobby } from '@/pug'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

const DUMMY_COUNT = 9

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'PUG admin only' }, { status: 403 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { roles } = body
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: 'roles array required' }, { status: 400 })
  }

  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    include: { players: true },
  })
  if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
  if (lobby.status !== 'OPEN') return NextResponse.json({ error: 'Lobby is not open' }, { status: 400 })

  const occupiedUserIds = new Set(lobby.players.map((p) => p.userId))

  // Find next available dummy slot
  let dummyUser: any = null
  let dummyPlayer: any = null

  for (let n = 1; n <= DUMMY_COUNT; n++) {
    const email = `dummy${n}@test.elemental`

    // Get or create dummy user
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      overrideAccess: true,
      limit: 1,
    })

    let du = existing.docs[0] as any
    if (!du) {
      du = await payload.create({
        collection: 'users',
        data: {
          email,
          name: `Dummy ${n}`,
          password: `dummy-${Math.random().toString(36)}`,
          role: 'player',
        } as any,
        overrideAccess: true,
      })
    }

    if (occupiedUserIds.has(du.id)) continue

    // Get or create pug-player record
    const playerResult = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: du.id } },
      overrideAccess: true,
      limit: 1,
    })

    let dp = playerResult.docs[0] as any
    if (!dp) {
      dp = await payload.create({
        collection: 'pug-players',
        data: {
          user: du.id,
          tiers: ['open'],
          registeredDate: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    } else if (!dp.tiers?.includes('open')) {
      await payload.update({
        collection: 'pug-players',
        id: dp.id,
        data: { tiers: [...(dp.tiers ?? []), 'open'] },
        overrideAccess: true,
      })
    }

    dummyUser = du
    dummyPlayer = dp
    break
  }

  if (!dummyUser) {
    return NextResponse.json({ error: 'All 9 dummy slots are already in this lobby' }, { status: 400 })
  }

  try {
    await joinLobby(lobbyId, dummyUser.id, roles)
    return NextResponse.json({ success: true, dummyName: dummyUser.name })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
