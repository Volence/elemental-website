import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/pug/lobby/[id]/host — Volunteer to host the in-game OW2 custom lobby.
 * Any player in the lobby can claim host. First come, first served.
 * PUG admins can host even if they're not a player in the lobby.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  try {
    const lobby = await prisma.pugLobby.findUnique({
      where: { id: lobbyId },
      include: { players: true },
    })

    if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
    if (lobby.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Lobby is not in progress' }, { status: 400 })
    }

    // Check if already claimed
    if (lobby.hostUserId) {
      return NextResponse.json({ error: 'A host has already been assigned' }, { status: 400 })
    }

    // Verify the user is a player in the lobby or a PUG admin
    const u = user as any
    const isPugAdmin = u?.departments?.isPugAdmin === true || u?.role === 'admin'
    const isPlayer = lobby.players.some((p) => p.userId === user.id)

    if (!isPlayer && !isPugAdmin) {
      return NextResponse.json({ error: 'Only players or PUG admins can host' }, { status: 403 })
    }

    await prisma.pugLobby.update({
      where: { id: lobbyId },
      data: { hostUserId: user.id as number },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
