import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { castMapVote, finalizeMapVote } from '@/pug'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { mapId } = body
  if (!mapId) return NextResponse.json({ error: 'mapId required' }, { status: 400 })

  const u = user as any
  const isPugAdmin = u?.departments?.isPugAdmin === true || u?.role === 'admin'

  if (isPugAdmin) {
    // Cast votes for all players then finalize immediately
    const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
    for (const p of players) {
      await castMapVote(lobbyId, p.userId, mapId).catch(() => {})
    }
    await finalizeMapVote(lobbyId)
    return NextResponse.json({ success: true })
  }

  try {
    await castMapVote(lobbyId, user.id, mapId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
