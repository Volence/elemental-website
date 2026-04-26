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

  try {
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

    // Enrich players with names
    const userIds = lobby.players.map((p) => p.userId)
    const users = await payload.find({
      collection: 'users',
      where: { id: { in: userIds } },
      limit: 20,
      overrideAccess: true,
    })
    const nameMap: Record<number, string> = {}
    for (const u of users.docs as any[]) nameMap[u.id] = u.name || u.email

    const enrichedPlayers = lobby.players.map((p) => ({
      ...p,
      name: nameMap[p.userId] ?? `Player #${p.userId}`,
    }))

    // Fetch heroes for ban phase
    let heroes: Array<{ id: number; name: string; role: string }> = []
    if (lobby.status === 'BANNING') {
      const heroResult = await payload.find({
        collection: 'heroes',
        where: { active: { equals: true } },
        limit: 100,
        overrideAccess: true,
      })
      heroes = (heroResult.docs as any[]).map((h) => ({ id: h.id, name: h.name, role: h.role }))
    }

    const u = user as any
    const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
    const guildId = process.env.DISCORD_GUILD_ID ?? null

    return NextResponse.json({
      lobby: { ...lobby, players: enrichedPlayers },
      selectedMap,
      mapCandidates,
      heroes,
      currentUserId: user.id,
      isPugAdmin,
      guildId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
