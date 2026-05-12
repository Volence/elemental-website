import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { generateSettings } from '@/pug/settingsGenerator'

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

    let selectedMap: { id: number; name: string; type?: string; settingsMapEntry?: string; imageUrl?: string | null } | null = null
    if (lobby.mapVote?.selectedMapId) {
      const map = await payload.findByID({
        collection: 'maps',
        id: lobby.mapVote.selectedMapId,
        overrideAccess: true,
      })
      const m = map as any
      selectedMap = { id: m.id, name: m.name, type: m.type, imageUrl: m.image?.url ?? null }
    }

    let mapCandidates: Array<{ id: number; name: string; imageUrl: string | null }> = []
    if (lobby.status === 'MAP_VOTE' && lobby.mapVote?.candidates) {
      mapCandidates = await Promise.all(
        lobby.mapVote.candidates.map(async (mapId) => {
          const map = await payload.findByID({ collection: 'maps', id: mapId, overrideAccess: true, depth: 1 })
          const m = map as any
          return { id: m.id, name: m.name, imageUrl: m.image?.url ?? null }
        }),
      )
    }

    // Enrich players with names and avatars
    const userIds = lobby.players.map((p) => p.userId)
    const users = await payload.find({
      collection: 'people',
      where: { id: { in: userIds } },
      limit: 20,
      depth: 1,
      overrideAccess: true,
    })
    const nameMap: Record<number, string> = {}
    const avatarMap: Record<number, string | null> = {}
    for (const u of users.docs as any[]) {
      nameMap[u.id] = u.name || 'Anonymous'
      avatarMap[u.id] = u.photo?.url ?? u.avatar?.url ?? null
    }

    const enrichedPlayers = lobby.players.map((p) => ({
      ...p,
      name: nameMap[p.userId] ?? `Player #${p.userId}`,
      avatarUrl: avatarMap[p.userId] ?? null,
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
      heroes = (heroResult.docs as any[]).map((h) => ({ id: h.id, name: h.name, role: h.role, imageUrl: h.image?.url ?? null }))
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
      const person = user as any
      if (person.pugApprovedRoles?.length) {
        approvedRoles = (person.pugApprovedRoles as string[]).map(
          (r: string) => r.replace(/-/g, '_'),
        )
      } else {
        approvedRoles = []
      }
      const playerRegions: string[] = person.pugInviteRegions ?? []
      const lobbyRegion = lobby.region
      if (lobbyRegion && playerRegions.length > 0) {
        regionAllowed = playerRegions.includes(lobbyRegion)
      } else if (lobbyRegion) {
        regionAllowed = false
      }
    }

    // Host setup data for IN_PROGRESS state
    let hostInfo: { hostUserId: number | null; hostName: string | null; settingsText: string | null; battleTags: Record<number, string | null> } | null = null
    const inProgressOrReporting = ['IN_PROGRESS', 'REPORTING'].includes(lobby.status)
    if (inProgressOrReporting) {
      // Generate settings text
      let settingsText: string | null = null
      if (selectedMap) {
        // Fetch ban hero names
        const banRecords = (lobby.banState?.bans ?? []) as Array<{ heroId: number }>
        let bannedHeroNames: string[] = []
        if (banRecords.length > 0) {
          const banHeroes = heroes.length > 0 ? heroes : []
          // If heroes weren't fetched yet, fetch them
          if (banHeroes.length === 0) {
            const heroResult = await payload.find({
              collection: 'heroes',
              where: { active: { equals: true } },
              limit: 100,
              overrideAccess: true,
            })
            for (const h of heroResult.docs as any[]) {
              banHeroes.push({ id: h.id, name: h.name, role: h.role })
            }
          }
          bannedHeroNames = banRecords
            .map((b) => banHeroes.find((h) => h.id === b.heroId)?.name)
            .filter(Boolean) as string[]
        }
        settingsText = generateSettings({
          mapSettingsEntry: selectedMap.name ?? null,
          mapType: selectedMap.type ?? 'control',
          bannedHeroes: bannedHeroNames,
        })
      }

      // Fetch BattleTags for all players
      const peopleResults = await payload.find({
        collection: 'people',
        where: { id: { in: userIds } },
        limit: 20,
        overrideAccess: true,
      })
      const battleTags: Record<number, string | null> = {}
      for (const pp of peopleResults.docs as any[]) {
        battleTags[pp.id] = pp.pugBattleTag ?? null
      }

      // Host name
      const hostName = lobby.hostUserId ? (nameMap[lobby.hostUserId] ?? null) : null

      hostInfo = {
        hostUserId: lobby.hostUserId,
        hostName,
        settingsText,
        battleTags,
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
      hostInfo,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
