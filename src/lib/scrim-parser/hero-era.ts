/**
 * Server-side helpers for heroes whose role changed between seasons (see heroKeyAt). Kept out of
 * heroes.ts, which the client bundles too.
 */
import prisma from '@/lib/prisma'
import { Prisma } from '../../../generated/prisma/client'
import { LEGACY_SOMBRA, SOMBRA_SUPPORT_SINCE, heroBaseName } from './heroes'

/** The day the scrim holding this map was played, or null if the map is unknown. */
export async function mapPlayedAt(mapDataId: number): Promise<Date | null> {
  const rows = await prisma.$queryRaw<Array<{ date: Date }>>`
    SELECT s.date
    FROM scrim_map_data md
    JOIN scrim_scrims s ON s.id = md."scrimId"
    WHERE md.id = ${mapDataId}
  `
  return rows[0]?.date ?? null
}

/**
 * SQL for a row's stats hero name: `alias.column`, with pre-Season 5 Sombra renamed to
 * LEGACY_SOMBRA. The table must carry "scrimId" (every scrim event table does).
 */
export function heroKeySql(alias: string, column: string): Prisma.Sql {
  const hero = Prisma.raw(`${alias}.${column}`)
  const scrimId = Prisma.raw(`${alias}."scrimId"`)
  return Prisma.sql`CASE WHEN ${hero} = 'Sombra'
    AND (SELECT s.date FROM scrim_scrims s WHERE s.id = ${scrimId}) < ${SOMBRA_SUPPORT_SINCE}::date
    THEN ${LEGACY_SOMBRA} ELSE ${hero} END`
}

/**
 * Prisma where-clause for the rows of a stats hero name: the in-game hero, limited to the scrims
 * of its era when the name is one of the split heroes.
 */
export async function heroKeyWhere(key: string): Promise<{ player_hero: string; scrimId?: { in: number[] } | { notIn: number[] } }> {
  const base = heroBaseName(key)
  if (base !== 'Sombra') return { player_hero: key }
  const before = await prisma.scrim.findMany({
    where: { date: { lt: new Date(`${SOMBRA_SUPPORT_SINCE}T00:00:00Z`) } },
    select: { id: true },
  })
  const ids = before.map((s) => s.id)
  return key === LEGACY_SOMBRA
    ? { player_hero: base, scrimId: { in: ids } }
    : { player_hero: base, scrimId: { notIn: ids } }
}
