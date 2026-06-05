import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { freeBotInstanceForLobby } from '@/pug/lobbyStateMachine'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/pug/lobby/[id]/host — Volunteer to host the in-game OW custom lobby.
 * Any player in the lobby can claim host. First come, first served.
 * PUG admins can host even if they're not a player in the lobby.
 *
 * Body { action: 'switchToManual' } — abandon a failed/errored bot handoff and
 * open the lobby for a human host. Clears the bot binding (hostUserId -1 ->
 * null, botStatus -> null) and frees the bot instance, so the existing
 * volunteer-host UI appears for everyone.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  let action: string | undefined
  try {
    action = (await request.json())?.action
  } catch {
    /* no body - default volunteer-to-host behaviour */
  }

  try {
    const lobby = await prisma.pugLobby.findUnique({
      where: { id: lobbyId },
      include: { players: true },
    })

    if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
    if (lobby.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Lobby is not in progress' }, { status: 400 })
    }

    const u = user as any
    const isPugAdmin = u?.departments?.isPugAdmin === true || u?.role === 'admin'
    const isPlayer = lobby.players.some((p) => p.userId === user.id)

    if (!isPlayer && !isPugAdmin) {
      return NextResponse.json({ error: 'Only players or PUG admins can host' }, { status: 403 })
    }

    if (action === 'switchToManual') {
      // Drop the bot binding so the lobby opens for a human host. Free the bot
      // instance too, otherwise it stays tagged to this lobby and unpickable.
      if (lobby.botInstanceId) {
        await freeBotInstanceForLobby(lobbyId, lobby.botInstanceId).catch(() => {})
      }
      await prisma.pugLobby.update({
        where: { id: lobbyId },
        // botStatus 'no_bot' marks the lobby manual so the bot doesn't auto
        // re-engage (it would, since bots are globally enabled and there's no
        // human host yet). The lobby page treats 'no_bot' as "show volunteer UI".
        data: { hostUserId: null, botStatus: 'no_bot', botInstanceId: null },
      })
      return NextResponse.json({ success: true, manual: true })
    }

    // Default: volunteer to become the host
    if (lobby.hostUserId) {
      return NextResponse.json({ error: 'A host has already been assigned' }, { status: 400 })
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
