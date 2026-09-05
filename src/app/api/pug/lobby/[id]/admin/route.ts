import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { freeBotInstanceForLobby } from '@/pug/lobbyStateMachine'
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

  const body = await request.json()
  const { action } = body

  try {
    if (action === 'swapTeam') {
      const { userId, team } = body
      await prisma.pugLobbyPlayer.update({
        where: { lobbyId_userId: { lobbyId, userId } },
        data: { team: team ?? null },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'setCaptain') {
      const { userId, isCaptain } = body
      await prisma.pugLobbyPlayer.update({
        where: { lobbyId_userId: { lobbyId, userId } },
        data: { isCaptain: isCaptain ?? false },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'setRole') {
      const { userId, assignedRole } = body
      await prisma.pugLobbyPlayer.update({
        where: { lobbyId_userId: { lobbyId, userId } },
        data: { assignedRole: assignedRole ?? null },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'forceStatus') {
      const { status } = body
      const validStatuses = ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING', 'COMPLETED', 'CANCELLED', 'DISPUTED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      const before = await prisma.pugLobby.findUnique({ where: { id: lobbyId }, select: { botInstanceId: true } })
      await prisma.pugLobby.update({
        where: { id: lobbyId },
        data: { status },
      })
      // Forcing a lobby out of the active flow should release any bound bot
      // instance (otherwise a reset mid code-import leaves it stuck Warming Up).
      if (['OPEN', 'READY', 'CANCELLED', 'COMPLETED', 'DISPUTED'].includes(status) && before?.botInstanceId) {
        await freeBotInstanceForLobby(lobbyId, before.botInstanceId)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'kick') {
      const { userId } = body
      await prisma.pugLobbyPlayer.delete({
        where: { lobbyId_userId: { lobbyId, userId } },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
