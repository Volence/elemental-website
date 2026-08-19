import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/access/requireAuth'
import {
  buildAliasMaps,
  resolveBackfillTarget,
  type BackfillPerson,
} from '@/lib/scrim-analytics/backfill-person-ids'

/**
 * POST /api/backfill-person-ids
 * Backfills personId on scrim_player_stats rows that are missing it.
 *
 * Curated gameAliases match any row; bare Person.name matches only stamp
 * rows whose scrim is linked to a team the person is rostered on, so an
 * opponent sharing a name with one of our People is never claimed.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { payload } = auth

    const { docs: people } = await payload.find({
      collection: 'people',
      pagination: false,
      depth: 0,
    })

    const maps = buildAliasMaps(people as unknown as BackfillPerson[])

    // Get distinct player names that are missing personId
    const missingRows = await prisma.$queryRaw<Array<{ player_name: string }>>`
      SELECT DISTINCT player_name FROM scrim_player_stats WHERE "personId" IS NULL
    `

    let updated = 0
    let skippedNoRosterLink = 0
    for (const row of missingRows) {
      const target = resolveBackfillTarget(row.player_name, maps)
      if (!target) continue

      if (target.requiresRosterCheck) {
        const result = await prisma.$executeRaw`
          UPDATE scrim_player_stats SET "personId" = ${target.personId}
          WHERE player_name = ${row.player_name} AND "personId" IS NULL
            AND "scrimId" IN (
              SELECT s.id FROM scrim_scrims s
              JOIN teams_roster tr ON tr.person_id = ${target.personId}
               AND (tr."_parent_id" = s."payloadTeamId" OR tr."_parent_id" = s."payloadTeamId2")
            )
        `
        updated += result
        if (result === 0) skippedNoRosterLink++
      } else {
        const result = await prisma.$executeRaw`
          UPDATE scrim_player_stats SET "personId" = ${target.personId}
          WHERE player_name = ${row.player_name} AND "personId" IS NULL
        `
        updated += result
      }
    }

    return NextResponse.json({
      success: true,
      peopleWithAliases: maps.aliasMap.size + maps.nameMap.size,
      missingPlayerNames: missingRows.length,
      rowsUpdated: updated,
      skippedNoRosterLink,
    })
  } catch (error: any) {
    console.error('[backfill-person-ids] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
