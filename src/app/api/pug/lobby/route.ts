import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { createOpenLobby } from '@/pug'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? 'open'
  const region = url.searchParams.get('region')

  const where: any = {
    tier: tier as any,
    status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS'] },
  }
  if (region) {
    where.region = region
  }

  const lobbies = await prisma.pugLobby.findMany({
    where,
    include: { players: true },
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

  const enriched = lobbies.map((lobby) => {
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
    return { ...lobby, neededSlots, blockedRoles, spotsAvailable }
  })

  return NextResponse.json({ lobbies: enriched })
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const pugPlayerResult = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })
    const pugPlayer = pugPlayerResult.docs[0] as any
    if (!pugPlayer?.tiers?.includes('open')) {
      return NextResponse.json({ error: 'You must register for open tier first' }, { status: 403 })
    }

    const body = await request.json()
    const { payloadSeasonId } = body
    if (!payloadSeasonId) return NextResponse.json({ error: 'payloadSeasonId required' }, { status: 400 })

    const lobby = await createOpenLobby(user.id, payloadSeasonId)
    return NextResponse.json({ lobby }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
