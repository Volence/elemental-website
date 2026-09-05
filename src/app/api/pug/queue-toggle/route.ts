import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { isPugRegion } from '@/pug/types'
import { createInviteLobby, cancelExpiredLobby, registerTimer, timerKey, INVITE_TIER_LATE_CANCEL_MS, clearQueueForRegion, processQueue } from '@/pug'
import { authenticateWithAccess, requireDepartment } from '@/utilities/apiAuth'

export async function POST(request: NextRequest) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { payload, access } = auth.data
  const deptCheck = requireDepartment(access, 'pug')
  if (deptCheck) return deptCheck

  const body = await request.json()
  const { region, action } = body
  if (!isPugRegion(region)) {
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

  const regionField = region

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
