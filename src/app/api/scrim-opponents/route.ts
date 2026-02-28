import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUserScope } from '@/access/scrimScope'

/**
 * GET /api/scrim-opponents?q=text
 * Returns distinct opponent names for autocomplete.
 * Merges from Scrim.opponentName overrides and raw match_start team names.
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await getUserScope()
    if (!scope) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''

    // 1. Get all opponent name overrides
    const overrides = await prisma.scrim.findMany({
      where: {
        opponentName: { not: null },
        ...(scope.isFullAccess ? {} : {
          OR: [
            { payloadTeamId: { in: scope.assignedTeamIds } },
            { payloadTeamId2: { in: scope.assignedTeamIds } },
          ],
        }),
      },
      select: { opponentName: true },
      distinct: ['opponentName'],
    })

    // 2. Get raw team names from match starts (both team_1 and team_2)
    const teamIdFilter = !scope.isFullAccess && scope.assignedTeamIds.length > 0
      ? scope.assignedTeamIds
      : null

    let rawNames: Array<{ name: string }> = []
    if (teamIdFilter) {
      rawNames = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT DISTINCT ms.team_2_name as name
        FROM scrim_match_starts ms
        JOIN scrim_map_data md ON md.id = ms."mapDataId"
        JOIN scrim_maps sm ON sm.id = md."mapId"
        JOIN scrim_scrims s ON s.id = sm."scrimId"
        WHERE s."payloadTeamId" = ANY(${teamIdFilter}::int[]) OR s."payloadTeamId2" = ANY(${teamIdFilter}::int[])
        UNION
        SELECT DISTINCT ms.team_1_name as name
        FROM scrim_match_starts ms
        JOIN scrim_map_data md ON md.id = ms."mapDataId"
        JOIN scrim_maps sm ON sm.id = md."mapId"
        JOIN scrim_scrims s ON s.id = sm."scrimId"
        WHERE s."payloadTeamId" = ANY(${teamIdFilter}::int[]) OR s."payloadTeamId2" = ANY(${teamIdFilter}::int[])
      `
    } else {
      rawNames = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT DISTINCT team_2_name as name FROM scrim_match_starts
        UNION
        SELECT DISTINCT team_1_name as name FROM scrim_match_starts
      `
    }

    // 3. Merge and deduplicate
    const allNames = new Set<string>()
    for (const o of overrides) {
      if (o.opponentName) allNames.add(o.opponentName)
    }
    for (const r of rawNames) {
      if (r.name) allNames.add(r.name)
    }

    // 4. Filter by query and sort
    let results = Array.from(allNames).sort((a, b) => a.localeCompare(b))
    if (q) {
      const lower = q.toLowerCase()
      results = results.filter(n => n.toLowerCase().includes(lower))
    }

    return NextResponse.json({ opponents: results.slice(0, 20) })
  } catch (error: any) {
    console.error('[scrim-opponents] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
