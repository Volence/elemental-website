import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { getActiveBan, processQueue, getQueuePosition } from '@/pug'

const VALID_ROLES = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tier = (url.searchParams.get('tier') ?? 'invite') as 'open' | 'invite'
  const region = url.searchParams.get('region')

  const person = user as any
  const pugTiers: string[] = person.pugTiers ?? []
  const pugRegions: string[] = person.pugInviteRegions ?? []
  const approvedRoles: string[] = (person.pugApprovedRoles ?? []).map((r: string) => r.replace(/-/g, '_'))
  const registeredForTier = pugTiers.includes(tier)
  const registeredForRegion = tier !== 'invite' || !region || pugRegions.includes(region)

  // Check if user is in an active lobby
  const activeLobbyPlayer = await prisma.pugLobbyPlayer.findFirst({
    where: {
      userId: user.id,
      lobby: { status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING'] } },
    },
    include: { lobby: true },
  })

  const entry = await prisma.pugQueueEntry.findUnique({
    where: { userId_tier: { userId: user.id, tier } },
  })

  const regInfo = { registeredForTier, registeredForRegion, approvedRoles }

  // Player is requeuing from an active game — keep the queue entry alive
  if (activeLobbyPlayer && entry && ['IN_PROGRESS', 'REPORTING'].includes(activeLobbyPlayer.lobby.status)) {
    await prisma.pugQueueEntry.update({
      where: { id: entry.id },
      data: { lastPing: new Date() },
    })
    const positionInfo = await getQueuePosition(user.id, tier)
    return NextResponse.json({
      inQueue: true,
      requeued: true,
      position: positionInfo?.position ?? 1,
      total: positionInfo?.total ?? 1,
      currentUserId: user.id,
      ...regInfo,
    })
  }

  // If placed in a lobby, clean up queue entry
  if (activeLobbyPlayer && entry) {
    await prisma.pugQueueEntry.delete({ where: { id: entry.id } })
  }

  if (!entry && !activeLobbyPlayer) {
    return NextResponse.json({ inQueue: false, currentUserId: user.id, ...regInfo })
  }

  if (activeLobbyPlayer) {
    return NextResponse.json({
      inQueue: false,
      placed: true,
      lobbyId: activeLobbyPlayer.lobbyId,
      currentUserId: user.id,
      ...regInfo,
    })
  }

  await prisma.pugQueueEntry.update({
    where: { id: entry!.id },
    data: { lastPing: new Date() },
  })

  const positionInfo = await getQueuePosition(user.id, tier)

  return NextResponse.json({
    inQueue: true,
    position: positionInfo?.position ?? 1,
    total: positionInfo?.total ?? 1,
    roles: entry!.roles,
    region: entry!.region,
    queuedAt: entry!.queuedAt,
    currentUserId: user.id,
    ...regInfo,
  })
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { roles, region, tier = 'invite' } = body

  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: 'roles array required' }, { status: 400 })
  }
  if (!roles.every((r: string) => VALID_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const person = user as any

  if (!person.pugTiers?.length) {
    return NextResponse.json({ error: 'Not registered for PUGs' }, { status: 403 })
  }

  const ban = await getActiveBan(user.id)
  if (ban) {
    return NextResponse.json(
      { error: `You are banned until ${ban.bannedUntil.toISOString()}. Reason: ${ban.reason}` },
      { status: 403 },
    )
  }

  const existingLobby = await prisma.pugLobbyPlayer.findFirst({
    where: {
      userId: user.id,
      lobby: { status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING'] } },
    },
  })
  if (existingLobby) {
    return NextResponse.json({ error: 'You are already in an active lobby' }, { status: 400 })
  }

  if (tier === 'invite') {
    if (!region || !['na', 'emea', 'pacific'].includes(region)) {
      return NextResponse.json({ error: 'region required for invite tier' }, { status: 400 })
    }
    if (!person.pugTiers?.includes('invite')) {
      return NextResponse.json({ error: `Not registered for ${region.toUpperCase()} Invite Tier` }, { status: 403 })
    }
    const playerRegions: string[] = person.pugInviteRegions ?? []
    if (!playerRegions.includes(region)) {
      return NextResponse.json(
        { error: `Not registered for ${region.toUpperCase()} Invite Tier` },
        { status: 403 },
      )
    }
    const approvedRolesNormalized = (person.pugApprovedRoles ?? []).map((r: string) => r.replace(/-/g, '_'))
    const invalidRoles = roles.filter((r: string) => !approvedRolesNormalized.includes(r))
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Not approved for roles: ${invalidRoles.join(', ')}` },
        { status: 403 },
      )
    }
  }

  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: tier } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any
  if (!season) {
    return NextResponse.json({ error: 'No active PUG season' }, { status: 400 })
  }

  if (tier === 'invite' && region) {
    const queueOpen = season?.regionQueueStatus?.[region] ?? false
    if (!queueOpen) {
      return NextResponse.json({ error: `${region.toUpperCase()} queue is not open` }, { status: 400 })
    }
  }

  try {
    await prisma.pugQueueEntry.upsert({
      where: { userId_tier: { userId: user.id, tier } },
      create: {
        userId: user.id,
        tier,
        region: region ?? null,
        roles: roles as any,
        payloadSeasonId: season.id,
      },
      update: {
        roles: roles as any,
        region: region ?? null,
        lastPing: new Date(),
      },
    })

    // Warm up an OW instance if the bot service is configured
    if (process.env.OW_BOT_SERVICE_URL) {
      fetch(`${process.env.OW_BOT_SERVICE_URL}/instance/warmup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Secret': process.env.OW_BOT_SECRET ?? '',
        },
        body: JSON.stringify({}),
      }).catch(() => {})
    }

    await processQueue(tier, region)

    const placed = await prisma.pugLobbyPlayer.findFirst({
      where: {
        userId: user.id,
        lobby: { status: { in: ['OPEN', 'READY'] } },
      },
    })

    if (placed) {
      await prisma.pugQueueEntry.deleteMany({
        where: { userId: user.id, tier },
      })
      return NextResponse.json({ success: true, placed: true, lobbyId: placed.lobbyId })
    }

    const positionInfo = await getQueuePosition(user.id, tier)
    return NextResponse.json({
      success: true,
      placed: false,
      position: positionInfo?.position ?? 1,
      total: positionInfo?.total ?? 1,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tier = (url.searchParams.get('tier') ?? 'invite') as 'open' | 'invite'

  await prisma.pugQueueEntry.deleteMany({
    where: { userId: user.id, tier },
  })

  return NextResponse.json({ success: true })
}
