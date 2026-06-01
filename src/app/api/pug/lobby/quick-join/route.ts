import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { joinLobby, getActiveBan, isPugRegion } from '@/pug'

const VALID_ROLES = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { roles, region } = body

  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: 'roles array required' }, { status: 400 })
  }
  if (!roles.every((r: string) => VALID_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (!isPugRegion(region)) {
    return NextResponse.json({ error: 'region required (na, emea, or pacific)' }, { status: 400 })
  }

  const person = user as any
  if (!person.pugTiers?.includes('open')) {
    return NextResponse.json({ error: 'Not registered for open tier' }, { status: 403 })
  }

  const ban = await getActiveBan(user.id)
  if (ban) {
    return NextResponse.json(
      { error: `You are banned until ${ban.bannedUntil.toISOString()}. Reason: ${ban.reason}` },
      { status: 403 },
    )
  }

  const openLobbies = await prisma.pugLobby.findMany({
    where: { tier: 'open', region, status: 'OPEN' },
    include: { _count: { select: { players: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Sort by player count descending (most populated first)
  openLobbies.sort((a, b) => b._count.players - a._count.players)

  for (const lobby of openLobbies) {
    try {
      await joinLobby(lobby.id, user.id, roles)
      return NextResponse.json({ success: true, lobbyId: lobby.id })
    } catch {
      // This lobby didn't work (role conflict, full, etc.) - try next
    }
  }

  return NextResponse.json(
    { error: 'No available lobbies to join. Try creating a new lobby.' },
    { status: 404 },
  )
}
