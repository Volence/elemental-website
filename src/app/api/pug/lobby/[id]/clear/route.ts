import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { cancelTimer, timerKey } from '@/pug/timers'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  try {
    const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
    if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
    if (!['OPEN', 'READY'].includes(lobby.status)) {
      return NextResponse.json({ error: 'Can only clear queue while lobby is open or in ready countdown' }, { status: 400 })
    }

    await prisma.pugLobbyPlayer.deleteMany({ where: { lobbyId } })
    await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'OPEN' } })
    cancelTimer(timerKey(lobbyId, 'ready'))

    import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
      updateLobbyFeed(lobbyId).catch(console.error)
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
