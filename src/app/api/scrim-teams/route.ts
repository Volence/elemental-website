import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUserScope } from '@/access/scrimScope'

/**
 * GET /api/scrim-teams
 * Returns one row per team that appears in scope, for the collapsed list view:
 *   { teams: [{ teamId, name, count, lastPlayed }], total }
 * `count` is how many scrims that team played (as either side); `lastPlayed`
 * is its most recent scrim date. `total` is the distinct scrim count in scope
 * (used for the page subtitle). Sorted by lastPlayed desc.
 * Query params: ?search=text
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() || ''

  const scope = await getUserScope()

  const where: Record<string, unknown> = {}
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  // Team scoping: non-full-access users only see their assigned teams as rows.
  let restrictTeamIds: number[] | null = null
  if (scope && !scope.isFullAccess) {
    if (scope.assignedTeamIds.length === 0) {
      return NextResponse.json({ teams: [], total: 0 })
    }
    restrictTeamIds = scope.assignedTeamIds
    where.OR = [
      { payloadTeamId: { in: scope.assignedTeamIds } },
      { payloadTeamId2: { in: scope.assignedTeamIds } },
    ]
  }

  const [total, byTeam1, byTeam2] = await Promise.all([
    prisma.scrim.count({ where }),
    prisma.scrim.groupBy({
      by: ['payloadTeamId'],
      where: { ...where, payloadTeamId: { not: null } },
      _count: true,
      _max: { date: true },
    }),
    prisma.scrim.groupBy({
      by: ['payloadTeamId2'],
      where: { ...where, payloadTeamId2: { not: null } },
      _count: true,
      _max: { date: true },
    }),
  ])

  // Merge primary + secondary appearances by team id: sum counts, keep latest date.
  const agg = new Map<number, { count: number; lastPlayed: Date }>()
  const addEntry = (id: number | null, count: number, date: Date | null) => {
    if (id == null) return
    const existing = agg.get(id)
    if (existing) {
      existing.count += count
      if (date && date > existing.lastPlayed) existing.lastPlayed = date
    } else {
      agg.set(id, { count, lastPlayed: date ?? new Date(0) })
    }
  }
  for (const r of byTeam1) addEntry(r.payloadTeamId, r._count, r._max.date)
  for (const r of byTeam2) addEntry(r.payloadTeamId2, r._count, r._max.date)

  let teamIds = [...agg.keys()]
  if (restrictTeamIds) {
    const allowed = new Set(restrictTeamIds)
    teamIds = teamIds.filter((id) => allowed.has(id))
  }

  // Resolve Payload team names.
  const nameMap = new Map<number, string>()
  if (teamIds.length > 0) {
    const rows = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
      SELECT id, name FROM teams WHERE id = ANY(${teamIds}::int[])
    `
    for (const r of rows) nameMap.set(r.id, r.name)
  }

  const teams = teamIds
    .map((id) => ({
      teamId: id,
      name: nameMap.get(id) ?? 'Unknown Team',
      count: agg.get(id)!.count,
      lastPlayed: agg.get(id)!.lastPlayed.toISOString(),
    }))
    .sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed))

  return NextResponse.json({ teams, total })
}
