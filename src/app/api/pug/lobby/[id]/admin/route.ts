import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { isPugAdmin } from '@/access/roles'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPugAdmin({ req: { user } } as any)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

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
      await prisma.pugLobby.update({
        where: { id: lobbyId },
        data: { status },
      })
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
