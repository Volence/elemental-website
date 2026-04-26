import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    include: { players: true, draftState: true, banState: true, mapVote: true },
  })

  if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })

  let selectedMap: { id: number; name: string } | null = null
  if (lobby.mapVote?.selectedMapId) {
    const map = await payload.findByID({
      collection: 'maps',
      id: lobby.mapVote.selectedMapId,
      overrideAccess: true,
    })
    selectedMap = { id: (map as any).id, name: (map as any).name }
  }

  let mapCandidates: Array<{ id: number; name: string }> = []
  if (lobby.status === 'MAP_VOTE' && lobby.mapVote?.candidates) {
    mapCandidates = await Promise.all(
      lobby.mapVote.candidates.map(async (mapId) => {
        const map = await payload.findByID({ collection: 'maps', id: mapId, overrideAccess: true })
        return { id: (map as any).id, name: (map as any).name }
      }),
    )
  }

  return NextResponse.json({ lobby, selectedMap, mapCandidates })
}
