/**
 * Scrim data access functions.
 * These query the scrim_player_stats table for final-round aggregated stats,
 * which are needed by the stat calculator and analytics.
 *
 * Ported from parsertime's scrim-dto.tsx — stripped of React cache() wrapper
 * and next-intl dependencies.
 */

import prisma from '@/lib/prisma'
import { type HeroName, heroRoleMapping } from './heroes'
import { removeDuplicateRows } from './utils'

/** Priority ordering: Tank > Damage > Support */
const heroPriority: Record<string, number> = {
  Tank: 0,
  Damage: 1,
  Support: 2,
}

/**
 * Get all player stats from the final round of a map.
 * Returns deduplicated, sorted by team → role → name.
 */
export async function getFinalRoundStats(mapId: number) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: number
      scrimId: number
      mapDataId: number
      match_time: number
      round_number: number
      player_name: string
      player_team: string
      player_hero: string
      eliminations: number
      final_blows: number
      deaths: number
      all_damage_dealt: number
      barrier_damage_dealt: number
      hero_damage_dealt: number
      healing_dealt: number
      healing_received: number
      self_healing: number
      damage_taken: number
      damage_blocked: number
      defensive_assists: number
      offensive_assists: number
      ultimates_earned: number
      ultimates_used: number
      multikill_best: number
      multikills: number
      solo_kills: number
      objective_kills: number
      environmental_kills: number
      environmental_deaths: number
      critical_hits: number
      critical_hit_accuracy: number
      scoped_accuracy: number
      scoped_critical_hit_accuracy: number
      scoped_critical_hit_kills: number
      shots_fired: number
      shots_hit: number
      shots_missed: number
      scoped_shots_fired: number
      scoped_shots_hit: number
      weapon_accuracy: number
      hero_time_played: number
    }>
  >`
    WITH maxTime AS (
      SELECT MAX("match_time") AS max_time
      FROM "scrim_player_stats"
      WHERE "mapDataId" = ${mapId}
    )
    SELECT ps.*
    FROM "scrim_player_stats" ps
    INNER JOIN maxTime m ON ps."match_time" = m.max_time
    WHERE ps."mapDataId" = ${mapId}
  `

  return removeDuplicateRows(rows)
    .sort((a, b) => a.player_name.localeCompare(b.player_name))
    .sort(
      (a, b) =>
        (heroPriority[heroRoleMapping[a.player_hero as HeroName]] ?? 3) -
        (heroPriority[heroRoleMapping[b.player_hero as HeroName]] ?? 3)
    )
    .sort((a, b) => a.player_team.localeCompare(b.player_team))
}

/**
 * Get final round stats for a specific player on a map.
 */
export async function getPlayerFinalStats(mapId: number, playerName: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: number
      scrimId: number
      mapDataId: number
      match_time: number
      round_number: number
      player_name: string
      player_team: string
      player_hero: string
      eliminations: number
      final_blows: number
      deaths: number
      all_damage_dealt: number
      barrier_damage_dealt: number
      hero_damage_dealt: number
      healing_dealt: number
      healing_received: number
      self_healing: number
      damage_taken: number
      damage_blocked: number
      defensive_assists: number
      offensive_assists: number
      ultimates_earned: number
      ultimates_used: number
      multikill_best: number
      multikills: number
      solo_kills: number
      objective_kills: number
      environmental_kills: number
      environmental_deaths: number
      critical_hits: number
      critical_hit_accuracy: number
      scoped_accuracy: number
      scoped_critical_hit_accuracy: number
      scoped_critical_hit_kills: number
      shots_fired: number
      shots_hit: number
      shots_missed: number
      scoped_shots_fired: number
      scoped_shots_hit: number
      weapon_accuracy: number
      hero_time_played: number
    }>
  >`
    WITH maxTime AS (
      SELECT MAX("match_time") AS max_time
      FROM "scrim_player_stats"
      WHERE "mapDataId" = ${mapId}
    )
    SELECT ps.*
    FROM "scrim_player_stats" ps
    INNER JOIN maxTime m ON ps."match_time" = m.max_time
    WHERE ps."mapDataId" = ${mapId}
      AND ps."player_name" = ${playerName}
  `

  return removeDuplicateRows(rows)
}

export type PlayerStatRow = Awaited<ReturnType<typeof getPlayerFinalStats>>[number]
