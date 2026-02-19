/**
 * Scrim analytics functions.
 * Ported from parsertime's analytics.ts — all self-contained queries
 * against our scrim_* tables (no external data dependencies).
 *
 * Functions:
 *  - getAverageUltChargeTime: avg seconds to charge each ult
 *  - getAverageTimeToUseUlt: avg ult hold time (charged → activated)
 *  - getKillsPerUltimate: kills with ult ability / total ults
 *  - getDuelWinrates: per-hero matchup kill/death aggregation
 *  - calculateDroughtTime: avg seconds between player kills
 *  - getAjaxes: Lúcio deaths during Sound Barrier (kill + ult end same timestamp)
 *  - calculateXFactor: role-weighted composite impact score
 */

import prisma from '@/lib/prisma'
import { type HeroName, heroRoleMapping } from './heroes'
import { getPlayerFinalStats } from './data-access'
import { groupKillsIntoFights, removeDuplicateRows, round } from './utils'

// ── Ultimate Economy ─────────────────────────────────────────────────

/**
 * Average time (seconds) to charge each ultimate.
 * Measures from when the previous ult ends to when the next one is charged.
 */
export async function getAverageUltChargeTime(
  mapId: number,
  playerName: string
): Promise<number> {
  const [ultimatesCharged, ultimateEnds] = await Promise.all([
    prisma.scrimUltimateCharged.findMany({
      where: { mapDataId: mapId, player_name: playerName },
    }),
    prisma.scrimUltimateEnd.findMany({
      where: { mapDataId: mapId, player_name: playerName },
    }),
  ])

  if (ultimatesCharged.length === 0) return 0

  const chargeTimes = [ultimatesCharged[0].match_time]

  for (let i = 0; i < ultimateEnds.length; i++) {
    const nextCharged = ultimatesCharged[i + 1]
    if (!nextCharged) break

    const currentEnd = ultimateEnds[i]
    const timeToNext = nextCharged.match_time - currentEnd.match_time

    // Skip negative durations (ult charged before previous was used — round boundary)
    if (timeToNext < 0) continue
    chargeTimes.push(timeToNext)
  }

  return chargeTimes.reduce((a, b) => a + b, 0) / chargeTimes.length
}

/**
 * Assigns round numbers to ult events by finding which round each event falls in.
 */
function assignRoundNumbers<T extends { match_time: number }>(
  events: T[],
  roundEnds: Array<{ match_time: number; round_number: number }>
): (T & { round_number?: number })[] {
  const sorted = [...roundEnds].sort((a, b) => a.match_time - b.match_time)

  return events.map((event) => {
    const round = sorted.find((r) => event.match_time <= r.match_time)
    return {
      ...event,
      round_number: round?.round_number ?? sorted[sorted.length - 1]?.round_number,
    }
  })
}

/**
 * Average time (seconds) between charging ult and activating it (hold time).
 * Pairs ult_charged → ult_start within the same round.
 */
export async function getAverageTimeToUseUlt(
  mapId: number,
  playerName: string
): Promise<number> {
  const [rawCharged, rawStarts, roundEnds] = await Promise.all([
    prisma.scrimUltimateCharged.findMany({
      where: { mapDataId: mapId, player_name: playerName },
    }),
    prisma.scrimUltimateStart.findMany({
      where: { mapDataId: mapId, player_name: playerName },
    }),
    prisma.scrimRoundEnd.findMany({ where: { mapDataId: mapId } }),
  ])

  const charged = assignRoundNumbers(rawCharged, roundEnds)
  const starts = assignRoundNumbers(rawStarts, roundEnds)

  type UltPair = { holdTime: number }
  const holdTimes: UltPair[] = []

  for (const c of charged) {
    if (!c.round_number) continue

    const matchingStart = starts.find(
      (s) =>
        s.match_time >= c.match_time &&
        s.round_number === c.round_number
    )

    if (matchingStart) {
      holdTimes.push({ holdTime: matchingStart.match_time - c.match_time })
    }
  }

  if (holdTimes.length === 0) return 0

  return holdTimes.reduce((acc, u) => acc + u.holdTime, 0) / holdTimes.length
}

/**
 * Total kills using ultimate ability / total ultimates charged.
 */
export async function getKillsPerUltimate(
  mapId: number,
  playerName: string
): Promise<number> {
  const [charged, ultKills] = await Promise.all([
    prisma.scrimUltimateCharged.findMany({
      where: { mapDataId: mapId, player_name: playerName },
    }),
    prisma.scrimKill.findMany({
      where: {
        mapDataId: mapId,
        attacker_name: playerName,
        event_ability: 'Ultimate',
      },
    }),
  ])

  if (charged.length === 0) return 0
  return ultKills.length / charged.length
}

// ── Duel Winrates ────────────────────────────────────────────────────

export type AggregatedDuel = {
  player_name: string
  player_hero: string
  player_team: string
  enemy_name: string
  enemy_hero: string
  enemy_team: string
  enemy_kills: number
  enemy_deaths: number
}

/**
 * Per-hero-matchup kill/death aggregation.
 * Groups kills by (player_hero, enemy_hero) and counts exchanges.
 */
export async function getDuelWinrates(
  mapId: number,
  playerName: string
): Promise<AggregatedDuel[]> {
  const [playerKills, playerDeaths] = await Promise.all([
    prisma.scrimKill.findMany({ where: { mapDataId: mapId, attacker_name: playerName } }),
    prisma.scrimKill.findMany({ where: { mapDataId: mapId, victim_name: playerName } }),
  ])

  const duels: Record<string, AggregatedDuel> = {}

  for (const kill of playerKills) {
    const key = `${kill.attacker_hero}-${kill.victim_hero}`
    if (!duels[key]) {
      duels[key] = {
        player_name: playerName,
        player_hero: kill.attacker_hero,
        player_team: kill.attacker_team,
        enemy_name: kill.victim_name,
        enemy_hero: kill.victim_hero,
        enemy_team: kill.victim_team,
        enemy_kills: 0,
        enemy_deaths: 1,
      }
    } else {
      duels[key].enemy_deaths++
    }
  }

  for (const death of playerDeaths) {
    const key = `${death.victim_hero}-${death.attacker_hero}`
    if (!duels[key]) {
      duels[key] = {
        player_name: playerName,
        player_hero: death.victim_hero,
        player_team: death.victim_team,
        enemy_name: death.attacker_name,
        enemy_hero: death.attacker_hero,
        enemy_team: death.attacker_team,
        enemy_kills: 1,
        enemy_deaths: 0,
      }
    } else {
      duels[key].enemy_kills++
    }
  }

  return Object.values(duels).sort((a, b) => a.enemy_name.localeCompare(b.enemy_name))
}

/** Average duel winrate across all hero matchups. */
async function calculateAverageDuelWinrate(
  mapId: number,
  playerName: string
): Promise<number> {
  const duels = await getDuelWinrates(mapId, playerName)
  if (duels.length === 0) return 0

  const winrates = duels.map((d) => {
    const total = d.enemy_kills + d.enemy_deaths
    return total > 0 ? (d.enemy_kills / total) * 100 : 0
  })

  return winrates.reduce((a, b) => a + b, 0) / winrates.length
}

// ── Drought Time ─────────────────────────────────────────────────────

/**
 * Average time (seconds) between a player's kills across a map.
 */
export async function calculateDroughtTime(
  mapId: number,
  playerName: string
): Promise<number> {
  const fights = await groupKillsIntoFights(mapId)

  const playerKills = fights
    .flatMap((f) => f.kills)
    .filter((k) => k.attacker_name === playerName)

  if (playerKills.length <= 1) return 0

  const droughts = playerKills.slice(1).map(
    (kill, i) => kill.match_time - playerKills[i].match_time
  )

  return round(droughts.reduce((a, b) => a + b, 0) / droughts.length)
}

// ── Ajaxes ───────────────────────────────────────────────────────────

/**
 * Count of "Ajaxes" — Lúcio dying during Sound Barrier.
 * Detected when a kill on Lúcio and an ult_end share the same match_time.
 */
export async function getAjaxes(
  mapId: number,
  playerName: string
): Promise<number> {
  const [kills, ultEnds] = await Promise.all([
    prisma.scrimKill.findMany({
      where: { mapDataId: mapId, victim_name: playerName, victim_hero: 'Lúcio' },
    }),
    prisma.scrimUltimateEnd.findMany({
      where: { mapDataId: mapId, player_name: playerName },
    }),
  ])

  return kills.filter((kill) =>
    ultEnds.some((end) => end.match_time === kill.match_time)
  ).length
}

// ── X-Factor (composite impact score) ────────────────────────────────

/**
 * Role-weighted composite impact score.
 *
 * DPS:     Fleta 50% | D/10 20% | First Pick 10% | Duels 10% | Reversals 10%
 * Tank:    Fleta 50% | D/10 20% | First Death 15% | Duels 5%  | Reversals 10%
 * Support: Fleta 50% | D/10 20% | Duels 15%       | Reversals 15%
 */
export async function calculateXFactor(
  mapId: number,
  playerName: string
): Promise<number> {
  const playerStats = await getPlayerFinalStats(mapId, playerName)
  if (playerStats.length === 0) return 0

  const mostPlayedHero = playerStats.sort(
    (a, b) => b.hero_time_played - a.hero_time_played
  )[0].player_hero
  const heroRole = heroRoleMapping[mostPlayedHero as HeroName] ?? 'Damage'

  const fights = await groupKillsIntoFights(mapId)
  if (fights.length === 0) return 0

  const firstKills = fights.map((f) => f.kills[0])
  const firstPickPct = round(
    (firstKills.filter((k) => k.attacker_name === playerName).length / fights.length) * 100
  )
  const firstDeathPct = round(
    (firstKills.filter((k) => k.victim_name === playerName).length / fights.length) * 100
  )

  const fightReversals = fights.filter((f) => {
    const playerKills = f.kills.filter((k) => k.attacker_name === playerName)
    const enemyKills = f.kills.filter((k) => k.attacker_name !== playerName)
    return playerKills.length === 0 && enemyKills.length > 1
  })
  const reversalPct = round((fightReversals.length / fights.length) * 100)

  const duelWinratePct = await calculateAverageDuelWinrate(mapId, playerName)

  // Fleta deadlift: player's final blows as % of rest of team's final blows
  const finalRound = await prisma.scrimRoundEnd.findFirst({
    where: { mapDataId: mapId },
    orderBy: { round_number: 'desc' },
  })

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
  const fletaPct = teamTotal > playerFB ? (playerFB / (teamTotal - playerFB)) * 100 : 0

  // Deaths per 10 minutes
  const dPer10Raw = await prisma.$queryRaw<Array<{ deaths_per_10: number }>>`
    SELECT (SUM(deaths) / NULLIF(SUM(hero_time_played / 600), 0)) AS deaths_per_10
    FROM "scrim_player_stats"
    WHERE "mapDataId" = ${mapId} AND "player_name" = ${playerName}
  `
  const dp10 = dPer10Raw[0]?.deaths_per_10 ?? 5
  const deathsScore = dp10 > 5 ? 0 - dp10 : 1 + dp10

  let xFactor = 0
  switch (heroRole) {
    case 'Damage':
      xFactor =
        fletaPct * 0.5 + deathsScore * 0.2 + firstPickPct * 0.1 +
        duelWinratePct * 0.1 + reversalPct * 0.1
      break
    case 'Tank':
      xFactor =
        fletaPct * 0.5 + deathsScore * 0.2 + firstDeathPct * 0.15 +
        duelWinratePct * 0.05 + reversalPct * 0.1
      break
    case 'Support':
      xFactor =
        fletaPct * 0.5 + deathsScore * 0.2 + duelWinratePct * 0.15 +
        reversalPct * 0.15
      break
  }

  return round(xFactor)
}
