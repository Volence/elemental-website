import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { joinLobby, leaveLobby, getActiveBan } from '@/pug'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  const body = await request.json()
  const { roles } = body
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: 'roles array required' }, { status: 400 })
  }

  const pugPlayers = await payload.find({
    collection: 'pug-players',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })
  const pugPlayer = pugPlayers.docs[0] as any
  if (!pugPlayer) return NextResponse.json({ error: 'Not registered for PUGs' }, { status: 403 })

  const ban = await getActiveBan(pugPlayer.id)
  if (ban) {
    return NextResponse.json(
      { error: `You are banned until ${ban.bannedUntil.toISOString()}. Reason: ${ban.reason}` },
      { status: 403 },
    )
  }

  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })

  if (lobby.tier === 'invite') {
    if (!pugPlayer.tiers?.includes('invite')) {
      return NextResponse.json({ error: 'Not registered for invite tier' }, { status: 403 })
    }
    if (lobby.region) {
      const playerRegions: string[] = pugPlayer.inviteRegions ?? []
      if (!playerRegions.includes(lobby.region)) {
        return NextResponse.json(
          { error: `Not invited to the ${lobby.region.toUpperCase()} region` },
          { status: 403 },
        )
      }
    }
    const approvedRolesNormalized = (pugPlayer.approvedRoles ?? []).map((r: string) => r.replace(/-/g, '_'))
    const invalidRoles = roles.filter((r: string) => !approvedRolesNormalized.includes(r))
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Not approved for roles: ${invalidRoles.join(', ')}` },
        { status: 403 },
      )
    }
  }

  try {
    await joinLobby(lobbyId, user.id, roles)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lobbyId = parseInt(id, 10)
  if (isNaN(lobbyId)) return NextResponse.json({ error: 'Invalid lobby ID' }, { status: 400 })

  try {
    await leaveLobby(lobbyId, user.id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
