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
    finalRound,
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
    prisma.scrimRoundEnd.findFirst({
      where: { mapDataId: mapId },
      orderBy: { round_number: 'desc' },
    }),
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

  return NextResponse.json({
    mapName: matchStart.map_name,
    mapType: matchStart.map_type,
    teams: { team1, team2 },
    summary: {
      matchTime: finalRound?.match_time ?? 0,
      score: `${finalRound?.team_1_score ?? 0} - ${finalRound?.team_2_score ?? 0}`,
      team1Damage: round(team1Damage),
      team2Damage: round(team2Damage),
      team1Healing: round(team1Healing),
      team2Healing: round(team2Healing),
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
    calculatedStats,
  })
}
