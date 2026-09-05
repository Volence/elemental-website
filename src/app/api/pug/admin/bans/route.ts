import { NextResponse, type NextRequest } from 'next/server'
import { authenticateWithAccess, authError } from '@/utilities/apiAuth'
import { hasDepartment } from '@/access'

async function requirePugAdmin(_request: NextRequest): Promise<{ error: string; status: number } | { payload: any; user: any }> {
  const auth = await authenticateWithAccess()
  if (!auth.success) return { error: 'Unauthorized', status: 401 }
  const { payload, user, access } = auth.data
  if (!hasDepartment(access, 'pug')) return { error: 'Forbidden', status: 403 }
  return { payload, user }
}

export async function GET(request: NextRequest) {
  const auth = await requirePugAdmin(request)
  if ('error' in auth) return authError(auth.status, auth.error)
  const { payload } = auth

  const url = new URL(request.url)
  const search = url.searchParams.get('search')

  if (search) {
    const results = await payload.find({
      collection: 'people',
      where: { name: { contains: search } },
      limit: 20,
      overrideAccess: true,
    })
    return NextResponse.json({
      players: (results.docs as any[]).map((p) => ({
        id: p.id,
        name: p.name || p.email,
        pugActiveBan: p.pugActiveBan ?? null,
        pugBanOffenseCount: p.pugBanOffenseCount ?? 0,
      })),
    })
  }

  const now = new Date().toISOString()
  const results = await payload.find({
    collection: 'people',
    where: {
      'pugActiveBan.bannedUntil': { greater_than: now },
    },
    limit: 100,
    overrideAccess: true,
  })

  return NextResponse.json({
    bans: (results.docs as any[]).map((p) => ({
      id: p.id,
      name: p.name || p.email,
      bannedUntil: p.pugActiveBan?.bannedUntil,
      reason: p.pugActiveBan?.reason ?? '',
      offenseCount: p.pugBanOffenseCount ?? 0,
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requirePugAdmin(request)
  if ('error' in auth) return authError(auth.status, auth.error)
  const { payload } = auth

  const body = await request.json()
  const { userId, durationHours, reason, incrementOffense } = body

  if (!userId || !durationHours || !reason) {
    return NextResponse.json({ error: 'userId, durationHours, and reason required' }, { status: 400 })
  }

  const person = await payload.findByID({
    collection: 'people',
    id: userId,
    overrideAccess: true,
  }) as any

  if (!person) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const bannedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000)
  const currentOffenses = (person.pugBanOffenseCount as number | null | undefined) ?? 0

  await payload.update({
    collection: 'people',
    id: userId,
    data: {
      pugActiveBan: {
        bannedUntil: bannedUntil.toISOString(),
        reason,
      },
      ...(incrementOffense ? { pugBanOffenseCount: currentOffenses + 1 } : {}),
    },
    overrideAccess: true,
  })

  const discordId = person.discordId
  if (discordId) {
    import('@/discord/services/pugNotifications').then(({ sendDm }) => {
      sendDm(
        discordId,
        `**PUG Ban**\nYou have been banned from PUGs until <t:${Math.floor(bannedUntil.getTime() / 1000)}:F>.\nReason: ${reason}`,
      ).catch(console.error)
    })
  }

  return NextResponse.json({
    success: true,
    bannedUntil: bannedUntil.toISOString(),
    offenseCount: incrementOffense ? currentOffenses + 1 : currentOffenses,
  })
}
