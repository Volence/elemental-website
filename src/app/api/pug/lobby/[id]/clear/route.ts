import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { cancelTimer, timerKey } from '@/pug/timers'
import { authenticateWithAccess, requireDepartment } from '@/utilities/apiAuth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const deptCheck = requireDepartment(auth.data.access, 'pug')
  if (deptCheck) return deptCheck

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
