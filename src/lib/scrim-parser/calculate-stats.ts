/**
 * Scrim stat calculator.
 * Ported from parsertime's calculate-stats.ts.
 *
 * Computes per-player stats for a given map:
 *  - Most played hero & role
 *  - First pick / first death percentages
 *  - Fleta deadlift percentage
 *  - Ult economy metrics (charge time, hold time, kills/ult)
 *  - Drought time (avg seconds between kills)
 *  - Duel winrates (per-hero matchup)
 *  - Ajax count (Lúcio ult deaths)
 *  - Fight reversal percentage
 *
 * Note: MVP score is stubbed — it requires a global stat distribution
 * dataset that we haven't built yet. X-Factor is available separately
 * via analytics.ts.
 */

import prisma from '@/lib/prisma'
import { type HeroName, heroRoleMapping } from './heroes'
import { getPlayerFinalStats } from './data-access'
import {
  getAverageUltChargeTime,
  getAverageTimeToUseUlt,
  getKillsPerUltimate,
  calculateDroughtTime,
  getDuelWinrates,
  getAjaxes,
  type AggregatedDuel,
} from './analytics'
import { groupKillsIntoFights, removeDuplicateRows, round } from './utils'

export type CalculatedPlayerStats = {
  playerName: string
  hero: string
  role: string
  fletaDeadliftPercentage: number
  firstPickPercentage: number
  firstPickCount: number
  firstDeathPercentage: number
  firstDeathCount: number
  ajaxCount: number
  averageUltChargeTime: number
  averageTimeToUseUlt: number
  droughtTime: number
  killsPerUltimate: number
  duels: AggregatedDuel[]
  fightReversalPercentage: number
}

/**
 * Calculate all available stats for a single player on a single map.
 */
export async function calculateStats(
  mapId: number,
  playerName: string
): Promise<CalculatedPlayerStats> {
  const [
    playerStats,
    fights,
    finalRound,
    averageUltChargeTime,
    averageTimeToUseUlt,
    killsPerUltimate,
    droughtTime,
    duels,
    ajaxCount,
  ] = await Promise.all([
    getPlayerFinalStats(mapId, playerName),
    groupKillsIntoFights(mapId),
    prisma.scrimRoundEnd.findFirst({
      where: { mapDataId: mapId },
      orderBy: { round_number: 'desc' },
    }),
    getAverageUltChargeTime(mapId, playerName),
    getAverageTimeToUseUlt(mapId, playerName),
    getKillsPerUltimate(mapId, playerName),
    calculateDroughtTime(mapId, playerName),
    getDuelWinrates(mapId, playerName),
    getAjaxes(mapId, playerName),
  ])

  // Most played hero by time
  const mostPlayedHero =
    playerStats.length > 0
      ? playerStats.sort((a, b) => b.hero_time_played - a.hero_time_played)[0].player_hero
      : 'Unknown'

  const heroRole = heroRoleMapping[mostPlayedHero as HeroName] ?? 'Damage'

  // First pick / first death from fights
  const firstKills = fights.map((f) => f.kills[0])
  const playerFirstKills = firstKills.filter((k) => k.attacker_name === playerName)
  const playerFirstDeaths = firstKills.filter((k) => k.victim_name === playerName)

  const firstPickPercentage =
    fights.length > 0 ? round((playerFirstKills.length / fights.length) * 100) : 0
  const firstDeathPercentage =
    fights.length > 0 ? round((playerFirstDeaths.length / fights.length) * 100) : 0

  // Fleta deadlift: player's FB as % relative to rest of team
  const team = playerStats[0]?.player_team
  const teamFinalBlows = removeDuplicateRows(
    await prisma.scrimPlayerStat.findMany({
      where: {
        mapDataId: mapId,
        player_team: team,
        round_number: finalRound?.round_number,
      },
      select: { id: true, final_blows: true, player_hero: true },
    })
  )

  const teamTotal = teamFinalBlows.reduce((acc, r) => acc + r.final_blows, 0)
  const playerFB = playerStats.reduce((acc, r) => acc + r.final_blows, 0)
  const fletaDeadliftPercentage =
    teamTotal > playerFB ? round((playerFB / (teamTotal - playerFB)) * 100) : 0

  // Fight reversals
  const fightReversals = fights.filter((f) => {
    const playerKills = f.kills.filter((k) => k.attacker_name === playerName)
    const enemyKills = f.kills.filter((k) => k.attacker_name !== playerName)
    return playerKills.length === 0 && enemyKills.length > 1
  })
  const fightReversalPercentage =
    fights.length > 0 ? round((fightReversals.length / fights.length) * 100) : 0

  return {
    playerName,
    hero: mostPlayedHero,
    role: heroRole.toUpperCase(),
    fletaDeadliftPercentage,
    firstPickPercentage,
    firstPickCount: playerFirstKills.length,
    firstDeathPercentage,
    firstDeathCount: playerFirstDeaths.length,
    ajaxCount,
    averageUltChargeTime: round(averageUltChargeTime),
    averageTimeToUseUlt: round(averageTimeToUseUlt),
    droughtTime: round(droughtTime),
    killsPerUltimate: round(killsPerUltimate),
    duels,
    fightReversalPercentage,
  }
}

/**
 * Calculate stats for ALL players on a map.
 * Returns an array sorted by team → role → name.
 */
export async function calculateStatsForMap(
  mapId: number
): Promise<CalculatedPlayerStats[]> {
  // Get unique player names from final round stats
  const finalStats = await prisma.$queryRaw<Array<{ player_name: string }>>`
    WITH maxTime AS (
      SELECT MAX("match_time") AS max_time
      FROM "scrim_player_stats"
      WHERE "mapDataId" = ${mapId}
    )
    SELECT DISTINCT ps."player_name"
    FROM "scrim_player_stats" ps
    INNER JOIN maxTime m ON ps."match_time" = m.max_time
    WHERE ps."mapDataId" = ${mapId}
  `

  const playerNames = finalStats.map((r) => r.player_name)

  // Calculate stats for each player in parallel
  const results = await Promise.all(
    playerNames.map((name) => calculateStats(mapId, name))
  )

  // Sort by role priority then name
  const rolePriority: Record<string, number> = { TANK: 0, DAMAGE: 1, SUPPORT: 2 }
  return results.sort((a, b) => {
    const rp = (rolePriority[a.role] ?? 3) - (rolePriority[b.role] ?? 3)
    if (rp !== 0) return rp
    return a.playerName.localeCompare(b.playerName)
  })
}
