import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/backfill-person-ids
 * Backfills personId on scrim_player_stats rows that are missing it.
 * Matches player_name against gameAliases from People records.
 */
export async function POST() {
  try {
    const payload = await getPayload({ config })

    // Get all People records with gameAliases
    const { docs: people } = await payload.find({
      collection: 'people',
      limit: 500,
      depth: 0,
    })

    // Build alias → personId map
    const aliasToPersonId = new Map<string, number>()
    for (const person of people) {
      const aliases = person.gameAliases as Array<{ alias?: string }> | undefined
      if (aliases && Array.isArray(aliases)) {
        for (const entry of aliases) {
          if (entry.alias) {
            aliasToPersonId.set(entry.alias.toLowerCase(), person.id as number)
          }
        }
      }
      // Also match by person name itself
      if (person.name) {
        aliasToPersonId.set((person.name as string).toLowerCase(), person.id as number)
      }
    }

    // Get distinct player names that are missing personId
    const missingRows = await prisma.$queryRaw<Array<{ player_name: string }>>`
      SELECT DISTINCT player_name FROM scrim_player_stats WHERE "personId" IS NULL
    `

    let updated = 0
    for (const row of missingRows) {
      const personId = aliasToPersonId.get(row.player_name.toLowerCase())
      if (personId) {
        const result = await prisma.$executeRaw`
          UPDATE scrim_player_stats SET "personId" = ${personId}
          WHERE player_name = ${row.player_name} AND "personId" IS NULL
        `
        updated += result
      }
    }

    return NextResponse.json({
      success: true,
      peopleWithAliases: aliasToPersonId.size,
      missingPlayerNames: missingRows.length,
      rowsUpdated: updated,
    })
  } catch (error: any) {
    console.error('[backfill-person-ids] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
