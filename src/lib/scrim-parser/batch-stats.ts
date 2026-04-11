/**
 * Batch stat calculator for player detail pages.
 * Computes first pick/death %, fleta deadlift, ult economy, and drought
 * across multiple maps in bulk queries instead of per-map queries.
 *
 * This replaces the per-map calculateStats() calls which produced
 * ~10 DB queries × N maps = 70+ queries for a typical player.
 */

import prisma from '@/lib/prisma'
import { round } from './utils'

export type BatchMapStats = {
  firstPickPercentage: number
  firstDeathPercentage: number
  fletaDeadliftPercentage: number
  averageUltChargeTime: number
  averageTimeToUseUlt: number
  killsPerUltimate: number
  droughtTime: number
}

/**
 * Compute advanced stats for a player across multiple maps in batch.
 * Returns a Map<mapDataId, BatchMapStats>.
 */
export async function batchCalculateStats(
  mapDataIds: number[],
  aliases: string[],
): Promise<Map<number, BatchMapStats>> {
  if (mapDataIds.length === 0 || aliases.length === 0) {
    return new Map()
  }

  // ── 1. Batch-load kills for all maps (used for fights, first pick/death, drought)
  const kills = await prisma.$queryRaw<Array<{
    mapDataId: number
    match_time: number
    attacker_name: string
    attacker_team: string
    attacker_hero: string
    victim_name: string
    victim_team: string
    victim_hero: string
    event_ability: string
  }>>`
    SELECT "mapDataId", match_time, attacker_name, attacker_team, attacker_hero,
           victim_name, victim_team, victim_hero, event_ability
    FROM scrim_kills
    WHERE "mapDataId" = ANY(${mapDataIds}::int[])
    ORDER BY "mapDataId", match_time
  `

  // ── 2. Batch-load ult events for all maps
  const [ultCharged, ultStarts, ultEnds] = await Promise.all([
    prisma.$queryRaw<Array<{ mapDataId: number; match_time: number; player_name: string }>>`
      SELECT "mapDataId", match_time, player_name FROM scrim_ultimate_charged
      WHERE "mapDataId" = ANY(${mapDataIds}::int[])
        AND player_name = ANY(${aliases}::text[])
      ORDER BY "mapDataId", match_time
    `,
    prisma.$queryRaw<Array<{ mapDataId: number; match_time: number; player_name: string }>>`
      SELECT "mapDataId", match_time, player_name FROM scrim_ultimate_starts
      WHERE "mapDataId" = ANY(${mapDataIds}::int[])
        AND player_name = ANY(${aliases}::text[])
      ORDER BY "mapDataId", match_time
    `,
    prisma.$queryRaw<Array<{ mapDataId: number; match_time: number; player_name: string }>>`
      SELECT "mapDataId", match_time, player_name FROM scrim_ultimate_ends
      WHERE "mapDataId" = ANY(${mapDataIds}::int[])
        AND player_name = ANY(${aliases}::text[])
      ORDER BY "mapDataId", match_time
    `,
  ])

  // ── 3. Batch-load player stats for fleta deadlift calc
  const playerTeamStats = await prisma.$queryRaw<Array<{
    mapDataId: number
    player_name: string
    player_team: string
    final_blows: number
    round_number: number
  }>>`
    SELECT ps."mapDataId", ps.player_name, ps.player_team, ps.final_blows, ps.round_number
    FROM scrim_player_stats ps
    WHERE ps."mapDataId" = ANY(${mapDataIds}::int[])
      AND ps.match_time = (
        SELECT MAX(ps2.match_time) FROM scrim_player_stats ps2 WHERE ps2."mapDataId" = ps."mapDataId"
      )
  `

  // ── Group data by mapDataId ──
  const killsByMap = new Map<number, typeof kills>()
  for (const k of kills) {
    if (!killsByMap.has(k.mapDataId)) killsByMap.set(k.mapDataId, [])
    killsByMap.get(k.mapDataId)!.push(k)
  }

  const ultChargedByMap = new Map<number, typeof ultCharged>()
  for (const u of ultCharged) {
    if (!ultChargedByMap.has(u.mapDataId)) ultChargedByMap.set(u.mapDataId, [])
    ultChargedByMap.get(u.mapDataId)!.push(u)
  }

  const ultStartsByMap = new Map<number, typeof ultStarts>()
  for (const u of ultStarts) {
    if (!ultStartsByMap.has(u.mapDataId)) ultStartsByMap.set(u.mapDataId, [])
    ultStartsByMap.get(u.mapDataId)!.push(u)
  }

  const ultEndsByMap = new Map<number, typeof ultEnds>()
  for (const u of ultEnds) {
    if (!ultEndsByMap.has(u.mapDataId)) ultEndsByMap.set(u.mapDataId, [])
    ultEndsByMap.get(u.mapDataId)!.push(u)
  }

  const teamStatsByMap = new Map<number, typeof playerTeamStats>()
  for (const s of playerTeamStats) {
    if (!teamStatsByMap.has(s.mapDataId)) teamStatsByMap.set(s.mapDataId, [])
    teamStatsByMap.get(s.mapDataId)!.push(s)
  }

  const aliasSet = new Set(aliases.map(a => a.toLowerCase()))

  // ── Compute per-map stats from pre-loaded data ──
  const results = new Map<number, BatchMapStats>()

  for (const mapId of mapDataIds) {
    const mapKills = killsByMap.get(mapId) ?? []
    const mapUltCharged = ultChargedByMap.get(mapId) ?? []
    const mapUltStarts = ultStartsByMap.get(mapId) ?? []
    const mapUltEnds = ultEndsByMap.get(mapId) ?? []
    const mapTeamStats = teamStatsByMap.get(mapId) ?? []

    // -- Group kills into fights (5s window) --
    const fights: Array<typeof mapKills> = []
    let currentFight: typeof mapKills = []
    for (const kill of mapKills) {
      if (kill.event_ability === 'Resurrect') continue
      if (currentFight.length === 0 || kill.match_time - currentFight[currentFight.length - 1].match_time <= 5) {
        currentFight.push(kill)
      } else {
        if (currentFight.length >= 2) fights.push(currentFight)
        currentFight = [kill]
      }
    }
    if (currentFight.length >= 2) fights.push(currentFight)

    // -- First pick / first death --
    let firstPicks = 0
    let firstDeaths = 0
    for (const fight of fights) {
      const firstKill = fight[0]
      if (aliasSet.has(firstKill.attacker_name.toLowerCase())) firstPicks++
      if (aliasSet.has(firstKill.victim_name.toLowerCase())) firstDeaths++
    }
    const fightCount = fights.length
    const firstPickPercentage = fightCount > 0 ? round((firstPicks / fightCount) * 100) : 0
    const firstDeathPercentage = fightCount > 0 ? round((firstDeaths / fightCount) * 100) : 0

    // -- Fleta deadlift --
    const playerTeam = mapTeamStats.find(s => aliasSet.has(s.player_name.toLowerCase()))?.player_team
    const teamFB = mapTeamStats
      .filter(s => s.player_team === playerTeam)
      .reduce((acc, s) => acc + s.final_blows, 0)
    const playerFB = mapTeamStats
      .filter(s => aliasSet.has(s.player_name.toLowerCase()))
      .reduce((acc, s) => acc + s.final_blows, 0)
    const fletaDeadliftPercentage =
      teamFB > playerFB ? round((playerFB / (teamFB - playerFB)) * 100) : 0

    // -- Ult charge time --
    let averageUltChargeTime = 0
    if (mapUltCharged.length > 0) {
      const chargeTimes = [mapUltCharged[0].match_time]
      for (let i = 0; i < mapUltEnds.length; i++) {
        const nextCharged = mapUltCharged[i + 1]
        if (!nextCharged) break
        const timeToNext = nextCharged.match_time - mapUltEnds[i].match_time
        if (timeToNext < 0) continue
        chargeTimes.push(timeToNext)
      }
      averageUltChargeTime = round(chargeTimes.reduce((a, b) => a + b, 0) / chargeTimes.length)
    }

    // -- Ult hold time (charged → start) --
    let averageTimeToUseUlt = 0
    if (mapUltCharged.length > 0 && mapUltStarts.length > 0) {
      const holdTimes: number[] = []
      for (const c of mapUltCharged) {
        const matchingStart = mapUltStarts.find(s => s.match_time >= c.match_time)
        if (matchingStart) {
          const holdTime = matchingStart.match_time - c.match_time
          if (holdTime >= 0) holdTimes.push(holdTime)
        }
      }
      if (holdTimes.length > 0) {
        averageTimeToUseUlt = round(holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length)
      }
    }

    // -- Kills per ultimate --
    const ultKills = mapKills.filter(
      k => aliasSet.has(k.attacker_name.toLowerCase()) && k.event_ability === 'Ultimate'
    )
    const killsPerUltimate = mapUltCharged.length > 0
      ? round(ultKills.length / mapUltCharged.length)
      : 0

    // -- Drought time --
    const playerKills = mapKills.filter(k => aliasSet.has(k.attacker_name.toLowerCase()))
    let droughtTime = 0
    if (playerKills.length > 1) {
      const droughts = playerKills.slice(1).map((k, i) => k.match_time - playerKills[i].match_time)
      droughtTime = round(droughts.reduce((a, b) => a + b, 0) / droughts.length)
    }

    results.set(mapId, {
      firstPickPercentage,
      firstDeathPercentage,
      fletaDeadliftPercentage,
      averageUltChargeTime,
      averageTimeToUseUlt,
      killsPerUltimate,
      droughtTime,
    })
  }

  return results
}

/**
 * Per-player calculated stats for a map.
 * Same fields as CalculatedPlayerStats from calculate-stats.ts.
 */
export type BatchCalculatedPlayerStats = {
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
  duels: Array<{
    player_name: string
    player_hero: string
    player_team: string
    enemy_name: string
    enemy_hero: string
    enemy_team: string
    enemy_kills: number
    enemy_deaths: number
  }>
  fightReversalPercentage: number
}

/**
 * Compute calculated stats for ALL players on a single map using batch queries.
 * Replaces calculateStatsForMap() which made ~10 queries × N players.
 * This version uses ~5 bulk queries total regardless of player count.
 */
export async function batchCalculateStatsForMap(
  mapId: number,
): Promise<BatchCalculatedPlayerStats[]> {
  // Load everything in parallel (5 queries total)
  const [kills, ultCharged, ultStarts, ultEnds, playerStatRows] = await Promise.all([
    prisma.$queryRaw<Array<{
      match_time: number; attacker_name: string; attacker_team: string; attacker_hero: string;
      victim_name: string; victim_team: string; victim_hero: string; event_ability: string;
    }>>`
      SELECT match_time, attacker_name, attacker_team, attacker_hero,
             victim_name, victim_team, victim_hero, event_ability
      FROM scrim_kills WHERE "mapDataId" = ${mapId} ORDER BY match_time
    `,
    prisma.$queryRaw<Array<{ match_time: number; player_name: string }>>`
      SELECT match_time, player_name FROM scrim_ultimate_charged
      WHERE "mapDataId" = ${mapId} ORDER BY match_time
    `,
    prisma.$queryRaw<Array<{ match_time: number; player_name: string }>>`
      SELECT match_time, player_name FROM scrim_ultimate_starts
      WHERE "mapDataId" = ${mapId} ORDER BY match_time
    `,
    prisma.$queryRaw<Array<{ match_time: number; player_name: string; player_hero: string }>>`
      SELECT match_time, player_name, player_hero FROM scrim_ultimate_ends
      WHERE "mapDataId" = ${mapId} ORDER BY match_time
    `,
    prisma.$queryRaw<Array<{
      player_name: string; player_team: string; player_hero: string;
      hero_time_played: number; final_blows: number;
    }>>`
      SELECT ps.player_name, ps.player_team, ps.player_hero, ps.hero_time_played, ps.final_blows
      FROM scrim_player_stats ps
      WHERE ps."mapDataId" = ${mapId}
        AND ps.match_time = (SELECT MAX(ps2.match_time) FROM scrim_player_stats ps2 WHERE ps2."mapDataId" = ${mapId})
    `,
  ])

  // Group kills into fights (5s window)
  type Kill = typeof kills[number]
  const fights: Kill[][] = []
  let currentFight: Kill[] = []
  for (const kill of kills) {
    if (kill.event_ability === 'Resurrect') continue
    if (currentFight.length === 0 || kill.match_time - currentFight[currentFight.length - 1].match_time <= 5) {
      currentFight.push(kill)
    } else {
      if (currentFight.length >= 2) fights.push(currentFight)
      currentFight = [kill]
    }
  }
  if (currentFight.length >= 2) fights.push(currentFight)

  // Get unique player names from final round stats
  const playerNames = [...new Set(playerStatRows.map(r => r.player_name))]

  // Pre-compute per-team final blows totals
  const teamFBTotals = new Map<string, number>()
  for (const ps of playerStatRows) {
    teamFBTotals.set(ps.player_team, (teamFBTotals.get(ps.player_team) ?? 0) + ps.final_blows)
  }

  // Group ult data by player
  const ultChargedByPlayer = new Map<string, typeof ultCharged>()
  for (const u of ultCharged) {
    if (!ultChargedByPlayer.has(u.player_name)) ultChargedByPlayer.set(u.player_name, [])
    ultChargedByPlayer.get(u.player_name)!.push(u)
  }
  const ultStartsByPlayer = new Map<string, typeof ultStarts>()
  for (const u of ultStarts) {
    if (!ultStartsByPlayer.has(u.player_name)) ultStartsByPlayer.set(u.player_name, [])
    ultStartsByPlayer.get(u.player_name)!.push(u)
  }
  const ultEndsByPlayer = new Map<string, typeof ultEnds>()
  for (const u of ultEnds) {
    if (!ultEndsByPlayer.has(u.player_name)) ultEndsByPlayer.set(u.player_name, [])
    ultEndsByPlayer.get(u.player_name)!.push(u)
  }

  // Import hero role mapping
  const { heroRoleMapping } = await import('./heroes')

  const results: BatchCalculatedPlayerStats[] = []

  for (const playerName of playerNames) {
    const pn = playerName.toLowerCase()
    const playerStats = playerStatRows.filter(s => s.player_name === playerName)
    if (playerStats.length === 0) continue

    // Most played hero
    const mostPlayedHero = playerStats.sort((a, b) => b.hero_time_played - a.hero_time_played)[0].player_hero
    const heroRole = (heroRoleMapping as Record<string, string>)[mostPlayedHero] ?? 'Damage'

    // First pick / first death
    let firstPickCount = 0
    let firstDeathCount = 0
    for (const fight of fights) {
      if (fight[0].attacker_name === playerName) firstPickCount++
      if (fight[0].victim_name === playerName) firstDeathCount++
    }
    const fightCount = fights.length
    const firstPickPercentage = fightCount > 0 ? round((firstPickCount / fightCount) * 100) : 0
    const firstDeathPercentage = fightCount > 0 ? round((firstDeathCount / fightCount) * 100) : 0

    // Fleta deadlift
    const playerTeam = playerStats[0].player_team
    const teamTotal = teamFBTotals.get(playerTeam) ?? 0
    const playerFB = playerStats.reduce((acc, s) => acc + s.final_blows, 0)
    const fletaDeadliftPercentage = teamTotal > playerFB
      ? round((playerFB / (teamTotal - playerFB)) * 100) : 0

    // Ult charge time
    const pUltCharged = ultChargedByPlayer.get(playerName) ?? []
    const pUltStarts = ultStartsByPlayer.get(playerName) ?? []
    const pUltEnds = ultEndsByPlayer.get(playerName) ?? []

    let averageUltChargeTime = 0
    if (pUltCharged.length > 0) {
      const chargeTimes = [pUltCharged[0].match_time]
      for (let i = 0; i < pUltEnds.length; i++) {
        const nextCharged = pUltCharged[i + 1]
        if (!nextCharged) break
        const t = nextCharged.match_time - pUltEnds[i].match_time
        if (t < 0) continue
        chargeTimes.push(t)
      }
      averageUltChargeTime = round(chargeTimes.reduce((a, b) => a + b, 0) / chargeTimes.length)
    }

    // Ult hold time
    let averageTimeToUseUlt = 0
    if (pUltCharged.length > 0 && pUltStarts.length > 0) {
      const holdTimes: number[] = []
      for (const c of pUltCharged) {
        const ms = pUltStarts.find(s => s.match_time >= c.match_time)
        if (ms) {
          const t = ms.match_time - c.match_time
          if (t >= 0) holdTimes.push(t)
        }
      }
      if (holdTimes.length > 0) {
        averageTimeToUseUlt = round(holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length)
      }
    }

    // Kills per ult
    const ultKills = kills.filter(k => k.attacker_name === playerName && k.event_ability === 'Ultimate')
    const killsPerUltimate = pUltCharged.length > 0 ? round(ultKills.length / pUltCharged.length) : 0

    // Drought time
    const playerKills = kills.filter(k => k.attacker_name === playerName && k.event_ability !== 'Resurrect')
    let droughtTime = 0
    if (playerKills.length > 1) {
      const droughts = playerKills.slice(1).map((k, i) => k.match_time - playerKills[i].match_time)
      droughtTime = round(droughts.reduce((a, b) => a + b, 0) / droughts.length)
    }

    // Ajax count (Lúcio dying during Sound Barrier)
    let ajaxCount = 0
    const lucioEnds = pUltEnds.filter(e => e.player_hero === 'Lúcio' || e.player_hero === 'Lucio')
    for (const ue of lucioEnds) {
      const deathDuringUlt = kills.some(k =>
        k.victim_name === playerName &&
        (k.victim_hero === 'Lúcio' || k.victim_hero === 'Lucio') &&
        k.match_time === ue.match_time
      )
      if (deathDuringUlt) ajaxCount++
    }

    // Duels
    const duels: Record<string, BatchCalculatedPlayerStats['duels'][number]> = {}
    for (const kill of kills) {
      if (kill.event_ability === 'Resurrect') continue
      if (kill.attacker_name === playerName) {
        const key = `${kill.attacker_hero}-${kill.victim_hero}`
        if (!duels[key]) {
          duels[key] = {
            player_name: playerName, player_hero: kill.attacker_hero, player_team: kill.attacker_team,
            enemy_name: kill.victim_name, enemy_hero: kill.victim_hero, enemy_team: kill.victim_team,
            enemy_kills: 0, enemy_deaths: 1,
          }
        } else {
          duels[key].enemy_deaths++
        }
      } else if (kill.victim_name === playerName) {
        const key = `${kill.victim_hero}-${kill.attacker_hero}`
        if (!duels[key]) {
          duels[key] = {
            player_name: playerName, player_hero: kill.victim_hero, player_team: kill.victim_team,
            enemy_name: kill.attacker_name, enemy_hero: kill.attacker_hero, enemy_team: kill.attacker_team,
            enemy_kills: 1, enemy_deaths: 0,
          }
        } else {
          duels[key].enemy_kills++
        }
      }
    }

    // Fight reversals
    const fightReversals = fights.filter(f => {
      const pKills = f.filter(k => k.attacker_name === playerName)
      const eKills = f.filter(k => k.attacker_name !== playerName)
      return pKills.length === 0 && eKills.length > 1
    })
    const fightReversalPercentage = fightCount > 0
      ? round((fightReversals.length / fightCount) * 100) : 0

    results.push({
      playerName,
      hero: mostPlayedHero,
      role: heroRole.toUpperCase(),
      fletaDeadliftPercentage,
      firstPickPercentage,
      firstPickCount,
      firstDeathPercentage,
      firstDeathCount,
      ajaxCount,
      averageUltChargeTime,
      averageTimeToUseUlt,
      droughtTime,
      killsPerUltimate,
      duels: Object.values(duels).sort((a, b) => a.enemy_name.localeCompare(b.enemy_name)),
      fightReversalPercentage,
    })
  }

  // Sort by role priority then name
  const rolePriority: Record<string, number> = { TANK: 0, DAMAGE: 1, SUPPORT: 2 }
  results.sort((a, b) => {
    const rp = (rolePriority[a.role] ?? 3) - (rolePriority[b.role] ?? 3)
    if (rp !== 0) return rp
    return a.playerName.localeCompare(b.playerName)
  })

  return results
}
