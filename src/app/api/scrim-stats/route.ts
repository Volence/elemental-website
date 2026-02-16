import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getFinalRoundStats } from '@/lib/scrim-parser/data-access'
import { groupKillsIntoFights, round } from '@/lib/scrim-parser/utils'
import { calculateStatsForMap } from '@/lib/scrim-parser/calculate-stats'

/**
 * GET /api/scrim-stats?mapId=N
 * Returns complete map-level analytics:
 *  - summary: match time, score, team damage/healing
 *  - players: final round stats for the stat table
 *  - analysis: fight-based insights
 *  - calculated: advanced per-player stats from calculateStatsForMap()
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mapIdStr = url.searchParams.get('mapId')

  if (!mapIdStr) {
    return NextResponse.json({ error: 'mapId is required' }, { status: 400 })
  }

  const mapId = parseInt(mapIdStr)
  if (isNaN(mapId)) {
    return NextResponse.json({ error: 'mapId must be a number' }, { status: 400 })
  }

  // Fetch all data in parallel
  const [
    matchStart,
    matchEnd,
    lastRoundEnd,
    allRoundStarts,
    maxKillTime,
    payloadProgress,
    finalRoundStats,
    fights,
    ultimateKills,
    calculatedStats,
  ] = await Promise.all([
    prisma.scrimMatchStart.findFirst({
      where: { mapDataId: mapId },
      select: {
        map_name: true,
        map_type: true,
        team_1_name: true,
        team_2_name: true,
      },
    }),
    prisma.scrimMatchEnd.findFirst({
      where: { mapDataId: mapId },
      orderBy: { round_number: 'desc' },
    }),
    prisma.scrimRoundEnd.findFirst({
      where: { mapDataId: mapId },
      orderBy: { round_number: 'desc' },
    }),
    // All round_starts — used for per-round attacking team names
    prisma.scrimRoundStart.findMany({
      where: { mapDataId: mapId },
      orderBy: { round_number: 'asc' },
      select: { round_number: true, capturing_team: true },
    }),
    // Actual max event time (handles truncated logs where round 2 has no round_end)
    prisma.$queryRaw<[{ max_time: number | null }]>`
      SELECT MAX(match_time) as max_time FROM scrim_kills WHERE "mapDataId" = ${mapId}
    `,
    // Payload progress per round — for Escort distance-based scoring
    prisma.$queryRaw<Array<{ round_number: number; capturing_team: string; max_progress: number }>>`
      SELECT round_number, capturing_team, MAX(payload_capture_progress) as max_progress
      FROM scrim_payload_progress
      WHERE "mapDataId" = ${mapId}
      GROUP BY round_number, capturing_team
      ORDER BY round_number
    `,
    getFinalRoundStats(mapId),
    groupKillsIntoFights(mapId),
    prisma.scrimKill.findMany({
      where: { mapDataId: mapId, event_ability: 'Ultimate' },
      select: { attacker_team: true },
    }),
    calculateStatsForMap(mapId),
  ])

  if (!matchStart) {
    return NextResponse.json({ error: 'Map not found' }, { status: 404 })
  }

  const team1 = matchStart.team_1_name ?? 'Team 1'
  const team2 = matchStart.team_2_name ?? 'Team 2'

  // Get attacking team per round from round_start data
  const round1Start = allRoundStarts.find(r => r.round_number === 1)
  const round2Start = allRoundStarts.find(r => r.round_number === 2)

  // Team aggregates from final round stats
  const team1Stats = finalRoundStats.filter((p) => p.player_team === team1)
  const team2Stats = finalRoundStats.filter((p) => p.player_team === team2)

  const team1Damage = team1Stats.reduce((a, p) => a + p.hero_damage_dealt, 0)
  const team2Damage = team2Stats.reduce((a, p) => a + p.hero_damage_dealt, 0)
  const team1Healing = team1Stats.reduce((a, p) => a + p.healing_dealt, 0)
  const team2Healing = team2Stats.reduce((a, p) => a + p.healing_dealt, 0)

  // First death analysis
  const team1FirstDeaths = fights.filter(
    (f) => f.kills[0]?.victim_team === team1
  ).length

  const team1UltKills = ultimateKills.filter((k) => k.attacker_team === team1).length
  const team2UltKills = ultimateKills.filter((k) => k.attacker_team === team2).length

  // Match time: use the latest event time available
  const actualMaxTime = maxKillTime?.[0]?.max_time ?? 0
  const matchTime = Math.max(
    matchEnd?.match_time ?? 0,
    lastRoundEnd?.match_time ?? 0,
    actualMaxTime,
  )

  // ── Score calculation ──
  // For Escort maps in scrim/practice mode, round_end score is always 0-0.
  // The practice code resets distance at round 2 start so both teams play the full map.
  // Real score is determined by comparing payload distance pushed per round:
  //   - Team that pushed further gets +1
  //   - If both pushed the same distance, it's a draw (0-0)
  let team1Score = 0
  let team2Score = 0

  const round1Progress = payloadProgress.find(p => p.round_number === 1)
  const round2Progress = payloadProgress.find(p => p.round_number === 2)

  if (matchEnd) {
    // If we have a match_end event, use its authoritative score
    team1Score = matchEnd.team_1_score ?? 0
    team2Score = matchEnd.team_2_score ?? 0
  } else if (matchStart.map_type === 'Escort' && payloadProgress.length > 0) {
    const round1Distance = round1Progress?.max_progress ?? 0
    const round2Distance = round2Progress?.max_progress ?? 0

    if (round2Distance > round1Distance) {
      team2Score = 1
    } else if (round1Distance > round2Distance) {
      team1Score = 1
    }
  } else {
    team1Score = lastRoundEnd?.team_1_score ?? 0
    team2Score = lastRoundEnd?.team_2_score ?? 0
  }

  // Distance data for objective-based maps (Escort, Hybrid, Push)
  // Use round_start.capturing_team for correct team names per round
  const distanceData = payloadProgress.length > 0 ? {
    distance: {
      round1: {
        team: round1Start?.capturing_team ?? round1Progress?.capturing_team ?? team1,
        meters: round(round1Progress?.max_progress ?? 0),
      },
      round2: {
        team: round2Start?.capturing_team ?? round2Progress?.capturing_team ?? team2,
        meters: round2Progress ? round(round2Progress.max_progress) : null, // null = incomplete/truncated
      },
    },
  } : {}

  return NextResponse.json({
    mapName: matchStart.map_name,
    mapType: matchStart.map_type,
    teams: { team1, team2 },
    summary: {
      matchTime,
      score: `${team1Score} - ${team2Score}`,
      team1Damage: round(team1Damage),
      team2Damage: round(team2Damage),
      team1Healing: round(team1Healing),
      team2Healing: round(team2Healing),
      ...distanceData,
    },
    players: finalRoundStats.map((p) => ({
      name: p.player_name,
      team: p.player_team,
      hero: p.player_hero,
      eliminations: p.eliminations,
      assists: p.defensive_assists + p.offensive_assists,
      deaths: p.deaths,
      damage: p.hero_damage_dealt,
      healing: p.healing_dealt,
      finalBlows: p.final_blows,
      timePlayed: p.hero_time_played,
    })),
    analysis: {
      totalFights: fights.length,
      team1FirstDeaths,
      team2FirstDeaths: fights.length - team1FirstDeaths,
      team1FirstDeathPct: fights.length > 0 ? round((team1FirstDeaths / fights.length) * 100) : 0,
      team2FirstDeathPct: fights.length > 0 ? round(((fights.length - team1FirstDeaths) / fights.length) * 100) : 0,
      team1UltKills,
      team2UltKills,
    },
    calculatedStats: calculatedStats.map((s) => ({
      ...s,
      duels: s.duels.map((d) => ({
        heroName: d.enemy_hero,
        wins: d.enemy_deaths,
        losses: d.enemy_kills,
        winRate: (d.enemy_deaths + d.enemy_kills) > 0
          ? round((d.enemy_deaths / (d.enemy_deaths + d.enemy_kills)) * 100)
          : 0,
      })),
    })),
  })
}
