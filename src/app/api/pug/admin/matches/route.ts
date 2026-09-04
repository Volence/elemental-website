import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { isPugAdmin } from '@/access/roles'
import { buildMatchRows, parseStatusFilter } from '@/pug/matchHistory'

const MAX_LIMIT = 100

/**
 * GET /api/pug/admin/matches
 * Finished lobbies (completed, disputed, cancelled) as match-history rows, newest first.
 * Query: tier=open|invite, status=finished|completed|disputed|cancelled, season=<pug-seasons id>,
 *        region=na|emea|pacific|sa, q=<lobby number>, page, limit (max 100).
 */
export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPugAdmin({ req: { user } } as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const tier = url.searchParams.get('tier')
  const region = url.searchParams.get('region')
  const season = Number(url.searchParams.get('season'))
  const q = (url.searchParams.get('q') ?? '').trim()
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 25))

  const where: any = { status: { in: parseStatusFilter(url.searchParams.get('status')) } }
  if (tier === 'open' || tier === 'invite') where.tier = tier
  if (region) where.region = region
  if (Number.isInteger(season) && season > 0) where.payloadSeasonId = season
  if (q) {
    const n = Number(q)
    if (!Number.isInteger(n)) return NextResponse.json({ rows: [], total: 0, page, limit })
    where.lobbyNumber = n
  }

  const [total, lobbies] = await Promise.all([
    prisma.pugLobby.count({ where }),
    prisma.pugLobby.findMany({
      where,
      include: { players: true, mapVote: true },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const userIds = [...new Set(lobbies.flatMap((l) => l.players.map((p) => p.userId)))]
  const seasonIds = [...new Set(lobbies.map((l) => l.payloadSeasonId).filter((id): id is number => id != null))]
  const mapIds = [...new Set(lobbies.map((l) => l.mapVote?.selectedMapId).filter((id): id is number => id != null))]

  const [people, seasons, maps] = await Promise.all([
    userIds.length
      ? payload.find({ collection: 'people', where: { id: { in: userIds } }, limit: userIds.length, depth: 0, overrideAccess: true, select: { name: true, email: true } })
      : { docs: [] as any[] },
    seasonIds.length
      ? payload.find({ collection: 'pug-seasons', where: { id: { in: seasonIds } }, limit: seasonIds.length, depth: 0, overrideAccess: true, select: { name: true } })
      : { docs: [] as any[] },
    mapIds.length
      ? payload.find({ collection: 'maps', where: { id: { in: mapIds } }, limit: mapIds.length, depth: 0, overrideAccess: true, select: { name: true } })
      : { docs: [] as any[] },
  ])

  const names = new Map<number, string>((people.docs as any[]).map((p) => [p.id, p.name || p.email || `Player #${p.id}`]))
  const seasonNames = new Map<number, string>((seasons.docs as any[]).map((s) => [s.id, s.name]))
  const mapNames = new Map<number, string>((maps.docs as any[]).map((m) => [m.id, m.name]))

  return NextResponse.json({
    rows: buildMatchRows(lobbies as any, names, seasonNames, mapNames),
    total,
    page,
    limit,
  })
}
