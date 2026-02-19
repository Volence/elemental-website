import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUserScope } from '@/access/scrimScope'

/**
 * GET /api/scrims
 * Returns paginated list of scrims with map counts, team name, and per-map scores.
 * Query params: ?page=1&limit=10&search=text&teamId=N
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10')))
  const search = url.searchParams.get('search')?.trim() || ''
  const teamIdStr = url.searchParams.get('teamId')
  const teamId = teamIdStr ? parseInt(teamIdStr) : null

  // Get user scope for data filtering
  const scope = await getUserScope()

  // Build where clause
  const where: Record<string, unknown> = {}
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  // Team scoping: for non-full-access users, limit to their assigned teams
  if (scope && !scope.isFullAccess && scope.assignedTeamIds.length > 0) {
    where.payloadTeamId = { in: scope.assignedTeamIds }
  } else if (scope && !scope.isFullAccess) {
    // No assigned teams — return empty
    return NextResponse.json({ scrims: [], pagination: { page, limit, total: 0, totalPages: 0 } })
  } else if (teamId && !isNaN(teamId)) {
    // Admin/staff-manager explicit team filter
    where.payloadTeamId = teamId
  }

  const skip = (page - 1) * limit

  const [scrims, total] = await Promise.all([
    prisma.scrim.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        maps: {
          select: {
            id: true,
            name: true,
            mapData: {
              select: { id: true },
            },
          },
        },
        _count: { select: { maps: true } },
      },
    }),
    prisma.scrim.count({ where }),
  ])

  // Resolve Payload team names for all scrims that have a payloadTeamId
  const teamIds = [...new Set(scrims.map(s => s.payloadTeamId).filter(Boolean))] as number[]
  const teamNameMap = new Map<number, string>()
  if (teamIds.length > 0) {
    const teams = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
      SELECT id, name FROM teams WHERE id = ANY(${teamIds}::int[])
    `
    for (const t of teams) {
      teamNameMap.set(t.id, t.name)
    }
  }

  // Get per-map opponent names + scores via match_start/match_end per mapData
  const allMapDataIds = scrims.flatMap(s => s.maps.map(m => m.mapData[0]?.id).filter(Boolean)) as number[]
  type MapInfo = {
    mapDataId: number; team1: string; team2: string; mapType: string | null;
    team1Score: number | null; team2Score: number | null;
    re_team1Score: number | null; re_team2Score: number | null;
  }
  let mapInfoMap = new Map<number, MapInfo>()
  const estimatedMapIds = new Set<number>()

  if (allMapDataIds.length > 0) {
    const mapInfoRows = await prisma.$queryRaw<MapInfo[]>`
      SELECT
        ms."mapDataId" as "mapDataId",
        ms.team_1_name as team1,
        ms.team_2_name as team2,
        ms.map_type as "mapType",
        me.team_1_score as "team1Score",
        me.team_2_score as "team2Score",
        re.team_1_score as "re_team1Score",
        re.team_2_score as "re_team2Score"
      FROM scrim_match_starts ms
      LEFT JOIN scrim_match_ends me ON me."mapDataId" = ms."mapDataId"
        AND me.round_number = (SELECT MAX(round_number) FROM scrim_match_ends WHERE "mapDataId" = ms."mapDataId")
      LEFT JOIN scrim_round_ends re ON re."mapDataId" = ms."mapDataId"
        AND re.round_number = (SELECT MAX(round_number) FROM scrim_round_ends WHERE "mapDataId" = ms."mapDataId")
      WHERE ms."mapDataId" = ANY(${allMapDataIds}::int[])
    `
    for (const row of mapInfoRows) {
      mapInfoMap.set(row.mapDataId, row)
    }

    // For Escort maps missing match_end scores, compute from payload progress
    const escortMissing = mapInfoRows.filter(r => r.team1Score == null && r.mapType === 'Escort')
    if (escortMissing.length > 0) {
      const escortIds = escortMissing.map(r => r.mapDataId)
      type PayloadMax = { mapDataId: number; round_number: number; max_progress: number }
      const progressRows = await prisma.$queryRaw<PayloadMax[]>`
        SELECT "mapDataId" as "mapDataId", round_number,
          MAX(payload_capture_progress)::float as max_progress
        FROM scrim_payload_progress
        WHERE "mapDataId" = ANY(${escortIds}::int[])
        GROUP BY "mapDataId", round_number
      `
      // Group by mapDataId
      const progressByMap = new Map<number, Map<number, number>>()
      for (const r of progressRows) {
        if (!progressByMap.has(r.mapDataId)) progressByMap.set(r.mapDataId, new Map())
        progressByMap.get(r.mapDataId)!.set(r.round_number, r.max_progress)
      }
      for (const r of escortMissing) {
        const rounds = progressByMap.get(r.mapDataId)
        if (!rounds) continue
        const r1 = rounds.get(1) ?? 0
        const r2 = rounds.get(2) ?? 0
        const existing = mapInfoMap.get(r.mapDataId)!
        if (r1 > r2) {
          existing.team1Score = 1; existing.team2Score = 0
        } else if (r2 > r1) {
          existing.team1Score = 0; existing.team2Score = 1
        } else {
          existing.team1Score = 0; existing.team2Score = 0
        }
        estimatedMapIds.add(r.mapDataId)
      }
    }
  }

  return NextResponse.json({
    scrims: scrims.map((s) => {
      const teamName = s.payloadTeamId ? teamNameMap.get(s.payloadTeamId) ?? null : null

      return {
        id: s.id,
        name: s.name,
        date: s.date.toISOString(),
        createdAt: s.createdAt.toISOString(),
        creatorEmail: s.creatorEmail,
        teamName,
        payloadTeamId: s.payloadTeamId ?? null,
        opponentName: s.opponentName ?? null,
        mapCount: s._count.maps,
        maps: s.maps.map((m) => {
          const mapDataId = m.mapData[0]?.id ?? null
          const info = mapDataId ? mapInfoMap.get(mapDataId) : null

          // Determine opponent: the team that isn't ours
          let opponent: string | null = null
          let score: string | null = null
          let result: 'win' | 'loss' | 'draw' | null = null
          let estimated = false
          if (info) {
            const ourTeamRaw = teamName
              ? (info.team1 === teamName || (s.payloadTeamId && teamNameMap.get(s.payloadTeamId))
                ? info.team1 : info.team2)
              : info.team1
            opponent = ourTeamRaw === info.team1 ? info.team2 : info.team1

            // Prefer scrim-level opponent name override
            if (s.opponentName) {
              opponent = s.opponentName
            }

            // Use match_end scores first, then round_end as fallback
            const t1 = info.team1Score ?? info.re_team1Score
            const t2 = info.team2Score ?? info.re_team2Score
            // Mark estimated if score came from a fallback (round_end, payload progress)
            if (mapDataId && estimatedMapIds.has(mapDataId)) {
              estimated = true
            } else if (info.team1Score == null && (t1 != null || t2 != null)) {
              // round_end fallback
              estimated = true
              if (mapDataId) estimatedMapIds.add(mapDataId)
            }
            if (t1 != null && t2 != null) {
              const ourScore = ourTeamRaw === info.team1 ? t1 : t2
              const theirScore = ourTeamRaw === info.team1 ? t2 : t1
              score = `${ourScore}-${theirScore}`
              if (ourScore > theirScore) result = 'win'
              else if (ourScore < theirScore) result = 'loss'
              else result = 'draw'
            }
          }

          return {
            id: m.id,
            name: m.name,
            mapDataId,
            opponent,
            score,
            result,
            estimated,
          }
        }),
      }
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

/**
 * DELETE /api/scrims?id=N
 * Deletes a scrim and all related data (cascading).
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const idStr = url.searchParams.get('id')

  if (!idStr) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const id = parseInt(idStr)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'id must be a number' }, { status: 400 })
  }

  try {
    await prisma.scrim.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Scrim not found' }, { status: 404 })
  }
}
