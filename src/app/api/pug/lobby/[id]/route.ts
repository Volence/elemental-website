import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })

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
    for (const u of users.docs as any[]) nameMap[u.id] = u.name || 'Anonymous'

    const enrichedPlayers = lobby.players.map((p) => ({
      ...p,
      name: nameMap[p.userId] ?? `Player #${p.userId}`,
    }))

    // Fetch heroes for banning phase display and for resolving ban names in other phases
    const needHeroes = lobby.status === 'BANNING' || (lobby.banState?.bans as any[])?.length > 0
    let heroes: Array<{ id: number; name: string; role: string }> = []
    if (needHeroes) {
      const heroResult = await payload.find({
        collection: 'heroes',
        where: { active: { equals: true } },
        limit: 100,
        overrideAccess: true,
      })
      heroes = (heroResult.docs as any[]).map((h) => ({ id: h.id, name: h.name, role: h.role }))
    }

    const allRoles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

    function canAllBeAssigned(players: Array<{ queuedRoles: string[] }>): boolean {
      const slots: Record<string, number> = { tank: 0, flex_dps: 0, hitscan_dps: 0, flex_support: 0, main_support: 0 }
      function bt(i: number): boolean {
        if (i === players.length) return true
        for (const r of players[i].queuedRoles) {
          if ((slots[r] ?? 0) < 2) { slots[r]++; if (bt(i + 1)) return true; slots[r]-- }
        }
        return false
      }
      return bt(0)
    }

    // Spread-first assignment: commit least-flexible players first, prefer least-used slots.
    // Gives a balanced picture of what's still needed (sum = 10 - players.length).
    function computeNeededSlots(players: Array<{ queuedRoles: string[] }>): Record<string, number> | null {
      const sorted = [...players].sort((a, b) => a.queuedRoles.length - b.queuedRoles.length)
      const slots: Record<string, number> = { tank: 0, flex_dps: 0, hitscan_dps: 0, flex_support: 0, main_support: 0 }
      function bt(i: number): boolean {
        if (i === sorted.length) return true
        const opts = sorted[i].queuedRoles
          .filter((r) => (slots[r] ?? 0) < 2)
          .sort((a, b) => (slots[a] ?? 0) - (slots[b] ?? 0))
        for (const r of opts) { slots[r]++; if (bt(i + 1)) return true; slots[r]-- }
        return false
      }
      if (!bt(0)) return null
      const needed: Record<string, number> = {}
      for (const r of allRoles) needed[r] = 2 - (slots[r] ?? 0)
      return needed
    }

    const playerRoles = lobby.players.map((p) => ({ queuedRoles: p.queuedRoles as string[] }))
    const spotsAvailable: Record<string, number> = {}
    for (const role of allRoles) {
      const with1 = [...playerRoles, { queuedRoles: [role] }]
      if (!canAllBeAssigned(with1)) { spotsAvailable[role] = 0; continue }
      const with2 = [...with1, { queuedRoles: [role] }]
      spotsAvailable[role] = canAllBeAssigned(with2) ? 2 : 1
    }
    const blockedRoles = allRoles.filter((r) => spotsAvailable[r] === 0)
    const neededSlots = computeNeededSlots(playerRoles)

    const u = user as any
    const isPugAdmin = u?.departments?.isPugAdmin === true || u?.role === 'admin'
    const guildId = process.env.DISCORD_GUILD_ID ?? null

    let approvedRoles: string[] | null = null
    let regionAllowed = true
    if (lobby.tier === 'invite' && user) {
      const pugPlayerResult = await payload.find({
        collection: 'pug-players',
        where: { user: { equals: user.id } },
        limit: 1,
        overrideAccess: true,
      })
      const pugPlayer = pugPlayerResult.docs[0] as any
      if (pugPlayer?.approvedRoles?.length) {
        approvedRoles = (pugPlayer.approvedRoles as string[]).map(
          (r: string) => r.replace(/-/g, '_'),
        )
      } else {
        approvedRoles = []
      }
      const playerRegions: string[] = pugPlayer?.inviteRegions ?? []
      const lobbyRegion = lobby.region
      if (lobbyRegion && playerRegions.length > 0) {
        regionAllowed = playerRegions.includes(lobbyRegion)
      } else if (lobbyRegion) {
        regionAllowed = false
      }
    }

    return NextResponse.json({
      lobby: { ...lobby, players: enrichedPlayers },
      selectedMap,
      mapCandidates,
      heroes,
      currentUserId: user?.id ?? null,
      isPugAdmin,
      guildId,
      blockedRoles,
      neededSlots,
      spotsAvailable,
      approvedRoles,
      regionAllowed,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
