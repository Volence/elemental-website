import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { createOpenLobby, isPugRegion } from '@/pug'
import { enrichSpectators } from '@/pug/spectators'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? 'open'
  const region = url.searchParams.get('region')

  const where: any = {
    tier: tier as any,
    status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING', 'DISPUTED'] },
  }
  if (region) {
    where.region = region
  }

  const lobbies = await prisma.pugLobby.findMany({
    where,
    include: { players: true, draftState: true, banState: true, mapVote: true },
    orderBy: { createdAt: 'desc' },
  })

  const ALL_ROLES = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

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
    for (const r of ALL_ROLES) needed[r] = 2 - (slots[r] ?? 0)
    return needed
  }

  const payload = await getPayload({ config: configPromise })
  const allUserIds = [...new Set(lobbies.flatMap((l) => l.players.map((p) => p.userId)))]
  const nameMap: Record<number, string> = {}
  const avatarMap: Record<number, string | null> = {}
  if (allUserIds.length > 0) {
    const users = await payload.find({
      collection: 'people',
      where: { id: { in: allUserIds } },
      limit: allUserIds.length,
      depth: 1,
      overrideAccess: true,
    })
    for (const u of users.docs as any[]) {
      nameMap[u.id] = u.name || 'Anonymous'
      avatarMap[u.id] = u.photo?.url ?? u.avatar?.url ?? null
    }
  }

  const enriched = await Promise.all(
    lobbies.map(async (lobby) => {
      const playerRoles = lobby.players.map((p) => ({ queuedRoles: p.queuedRoles as string[] }))
      const spotsAvailable: Record<string, number> = {}
      for (const role of ALL_ROLES) {
        const with1 = [...playerRoles, { queuedRoles: [role] }]
        if (!canAllBeAssigned(with1)) { spotsAvailable[role] = 0; continue }
        const with2 = [...with1, { queuedRoles: [role] }]
        spotsAvailable[role] = canAllBeAssigned(with2) ? 2 : 1
      }
      const blockedRoles = ALL_ROLES.filter((r) => spotsAvailable[r] === 0)
      const neededSlots = computeNeededSlots(playerRoles)
      const enrichedPlayers = lobby.players.map((p) => ({
        ...p,
        name: nameMap[p.userId] ?? `Player #${p.userId}`,
        avatarUrl: avatarMap[p.userId] ?? null,
      }))
      const spectators = await enrichSpectators(lobby.id)
      return { ...lobby, players: enrichedPlayers, neededSlots, blockedRoles, spotsAvailable, spectators }
    }),
  )

  let regionQueueStatus: Record<string, boolean> | null = null
  let seasonId: number | undefined
  if (tier === 'invite') {
    const activeSeason = await payload.find({
      collection: 'pug-seasons',
      where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
      overrideAccess: true,
      limit: 1,
    })
    const season = activeSeason.docs[0] as any
    if (!season) {
      return NextResponse.json({ error: 'No active PUG season' }, { status: 400 })
    }
    seasonId = season.id
    if (season?.regionQueueStatus) {
      regionQueueStatus = {
        na: season.regionQueueStatus.na ?? false,
        emea: season.regionQueueStatus.emea ?? false,
        pacific: season.regionQueueStatus.pacific ?? false,
      }
    }
  }

  return NextResponse.json({ lobbies: enriched, regionQueueStatus, seasonId })
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { payloadSeasonId, tier = 'open', region } = body
    if (!payloadSeasonId) return NextResponse.json({ error: 'payloadSeasonId required' }, { status: 400 })

    const person = user as any

    if (tier === 'invite') {
      if (!person.pugTiers?.includes('invite')) {
        return NextResponse.json({ error: 'Not registered for invite tier' }, { status: 403 })
      }
      if (!isPugRegion(region)) {
        return NextResponse.json({ error: 'region required for invite tier' }, { status: 400 })
      }
      const playerRegions: string[] = person.pugInviteRegions ?? []
      if (!playerRegions.includes(region)) {
        return NextResponse.json({ error: `Not invited to ${region.toUpperCase()} region` }, { status: 403 })
      }

      const season = await payload.findByID({
        collection: 'pug-seasons',
        id: payloadSeasonId,
        overrideAccess: true,
      }) as any
      const queueOpen = season?.regionQueueStatus?.[region] ?? false
      if (!queueOpen) {
        return NextResponse.json({ error: `${region.toUpperCase()} queue is not open` }, { status: 400 })
      }

      const openLobbies = await prisma.pugLobby.findMany({
        where: {
          tier: 'invite',
          region,
          payloadSeasonId,
          status: 'OPEN',
        },
        include: { _count: { select: { players: true } } },
      })
      const hasJoinableLobby = openLobbies.some((l) => l._count.players < 8)
      if (hasJoinableLobby) {
        return NextResponse.json({ error: 'An open lobby with available spots exists for this region' }, { status: 409 })
      }

      const { createInviteLobby } = await import('@/pug')
      const lobby = await createInviteLobby(payloadSeasonId, region)
      return NextResponse.json({ lobby }, { status: 201 })
    }

    if (!person.pugTiers?.includes('open')) {
      return NextResponse.json({ error: 'You must register for open tier first' }, { status: 403 })
    }
    if (!isPugRegion(region)) {
      return NextResponse.json({ error: 'region required (na, emea, or pacific)' }, { status: 400 })
    }

    // One joinable lobby at a time per region: funnel into the existing open
    // lobby for this region if one has room, otherwise create a fresh one.
    const existing = await prisma.pugLobby.findFirst({
      where: { tier: 'open', region, payloadSeasonId, status: 'OPEN' },
      include: { _count: { select: { players: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (existing && existing._count.players < 10) {
      return NextResponse.json({ lobby: existing, created: false }, { status: 200 })
    }

    const lobby = await createOpenLobby(user.id, payloadSeasonId, region)
    return NextResponse.json({ lobby, created: true }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
