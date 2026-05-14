import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { createInviteLobby, cancelExpiredLobby, registerTimer, timerKey, INVITE_TIER_LATE_CANCEL_MS, clearQueueForRegion, processQueue } from '@/pug'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { region, action } = body
  if (!region || !['na', 'emea', 'pacific'].includes(region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  }
  if (!action || !['open', 'close'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action (open or close)' }, { status: 400 })
  }

  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'invite' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any
  if (!season) {
    return NextResponse.json({ error: 'No active invite season' }, { status: 400 })
  }

  const regionField = region as 'na' | 'emea' | 'pacific'

  if (action === 'open') {
    if (season.regionQueueStatus?.[regionField]) {
      return NextResponse.json({ error: `${region.toUpperCase()} queue is already open` }, { status: 400 })
    }

    await payload.update({
      collection: 'pug-seasons',
      id: season.id,
      data: { regionQueueStatus: { ...season.regionQueueStatus, [regionField]: true } },
      overrideAccess: true,
    })

    const lobby = await createInviteLobby(season.id, region)
    await processQueue('invite', region).catch(console.error)
    return NextResponse.json({ success: true, lobby })
  }

  if (action === 'close') {
    if (!season.regionQueueStatus?.[regionField]) {
      return NextResponse.json({ error: `${region.toUpperCase()} queue is already closed` }, { status: 400 })
    }

    await payload.update({
      collection: 'pug-seasons',
      id: season.id,
      data: { regionQueueStatus: { ...season.regionQueueStatus, [regionField]: false } },
      overrideAccess: true,
    })

    const openLobbies = await prisma.pugLobby.findMany({
      where: {
        tier: 'invite',
        region,
        payloadSeasonId: season.id,
        status: 'OPEN',
      },
    })

    const graceDeadline = new Date(Date.now() + INVITE_TIER_LATE_CANCEL_MS)
    for (const lobby of openLobbies) {
      await prisma.pugLobby.update({
        where: { id: lobby.id },
        data: { timeoutAt: graceDeadline },
      })
      registerTimer(timerKey(lobby.id, 'timeout'), INVITE_TIER_LATE_CANCEL_MS, () =>
        cancelExpiredLobby(lobby.id),
      )
    }

    const cleared = await clearQueueForRegion('invite', region)

    return NextResponse.json({
      success: true,
      gracePeriodLobbies: openLobbies.length,
      graceDeadline: graceDeadline.toISOString(),
      queueEntriesCleared: cleared,
    })
  }
}
