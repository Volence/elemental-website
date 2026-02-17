import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getFinalRoundStats } from '@/lib/scrim-parser/data-access'
import { groupKillsIntoFights, round } from '@/lib/scrim-parser/utils'
import { calculateStatsForMap } from '@/lib/scrim-parser/calculate-stats'
import { heroRoleMapping } from '@/lib/scrim-parser/heroes'

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

  const tab = url.searchParams.get('tab')

  // ── Tab-specific endpoints ──

  if (tab === 'killfeed') {
    return getKillfeedData(mapId)
  }

  if (tab === 'events') {
    return getEventsData(mapId)
  }

  if (tab === 'charts') {
    return getChartsData(mapId)
  }

  if (tab === 'compare') {
    return getCompareData(mapId)
  }

  // ── Overview (existing behavior) ──

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
  let team1Score = 0
  let team2Score = 0

  const round1Progress = payloadProgress.find(p => p.round_number === 1)
  const round2Progress = payloadProgress.find(p => p.round_number === 2)

  if (matchEnd) {
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
  const distanceData = payloadProgress.length > 0 ? {
    distance: {
      round1: {
        team: round1Start?.capturing_team ?? round1Progress?.capturing_team ?? team1,
        meters: round(round1Progress?.max_progress ?? 0),
      },
      round2: {
        team: round2Start?.capturing_team ?? round2Progress?.capturing_team ?? team2,
        meters: round2Progress ? round(round2Progress.max_progress) : null,
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
      role: (heroRoleMapping as Record<string, string>)[p.player_hero] ?? 'Damage',
      eliminations: p.eliminations,
      assists: p.defensive_assists + p.offensive_assists,
      deaths: p.deaths,
      damage: round(p.hero_damage_dealt),
      healing: round(p.healing_dealt),
      finalBlows: p.final_blows,
      timePlayed: p.hero_time_played,
      kd: p.deaths > 0 ? round(p.eliminations / p.deaths) : p.eliminations,
      kad: p.deaths > 0 ? round((p.eliminations + (p.defensive_assists + p.offensive_assists)) / p.deaths) : p.eliminations + (p.defensive_assists + p.offensive_assists),
      damageReceived: round(p.damage_taken),
      healingReceived: round(p.healing_received),
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

// ══════════════════════════════════════════════════════════════════════
// Tab-specific data handlers
// ══════════════════════════════════════════════════════════════════════

async function getKillfeedData(mapId: number) {
  const [matchStart, fights] = await Promise.all([
    prisma.scrimMatchStart.findFirst({
      where: { mapDataId: mapId },
      select: { team_1_name: true, team_2_name: true },
    }),
    groupKillsIntoFights(mapId),
  ])

  if (!matchStart) {
    return NextResponse.json({ error: 'Map not found' }, { status: 404 })
  }

  const team1 = matchStart.team_1_name ?? 'Team 1'
  const team2 = matchStart.team_2_name ?? 'Team 2'

  // Compute fight winners and per-team kill/death counts
  let team1FightWins = 0
  let team2FightWins = 0
  let team1Kills = 0
  let team2Kills = 0

  const fightData = fights.map((fight, i) => {
    // Count kills per team in this fight (exclude Resurrect from kill counting)
    const t1Kills = fight.kills.filter(k => k.attacker_team === team1 && k.event_ability !== 'Resurrect').length
    const t2Kills = fight.kills.filter(k => k.attacker_team === team2 && k.event_ability !== 'Resurrect').length
    team1Kills += t1Kills
    team2Kills += t2Kills

    // Fight winner = team with more kills
    let winner = 'Draw'
    if (t1Kills > t2Kills) { winner = team1; team1FightWins++ }
    else if (t2Kills > t1Kills) { winner = team2; team2FightWins++ }

    return {
      fightNumber: i + 1,
      start: round(fight.start),
      end: round(fight.end),
      winner,
      kills: fight.kills.map(k => ({
        time: round(k.match_time),
        attackerTeam: k.attacker_team,
        attackerName: k.attacker_name,
        attackerHero: k.attacker_hero,
        victimTeam: k.victim_team,
        victimName: k.victim_name,
        victimHero: k.victim_hero,
        ability: k.event_ability,
        damage: k.event_damage,
        isCritical: k.is_critical_hit === '1' || k.is_critical_hit === 'True',
        isEnvironmental: k.is_environmental === '1' || k.is_environmental === 'True',
      })),
    }
  })

  const matchTime = fights.length > 0
    ? round(fights[fights.length - 1].end - fights[0].start)
    : 0

  return NextResponse.json({
    teams: { team1, team2 },
    matchTime,
    team1Kills,
    team2Kills,
    team1Deaths: team2Kills,
    team2Deaths: team1Kills,
    team1FightWins,
    team2FightWins,
    fights: fightData,
  })
}

async function getEventsData(mapId: number) {
  const [
    matchStart, roundStarts, roundEnds, objectivesCaptured,
    ultStarts, ultEnds, kills, mercyRezzes, pointProgress, defensiveAssists,
    fights,
  ] = await Promise.all([
    prisma.scrimMatchStart.findFirst({
      where: { mapDataId: mapId },
      select: { team_1_name: true, team_2_name: true, map_name: true, map_type: true, match_time: true },
    }),
    prisma.scrimRoundStart.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
    }),
    prisma.scrimRoundEnd.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
    }),
    prisma.scrimObjectiveCaptured.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
    }),
    prisma.scrimUltimateStart.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
      select: {
        match_time: true,
        player_team: true,
        player_name: true,
        player_hero: true,
        ultimate_id: true,
      },
    }),
    prisma.scrimUltimateEnd.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
      select: {
        match_time: true,
        player_team: true,
        player_name: true,
        player_hero: true,
        ultimate_id: true,
      },
    }),
    prisma.scrimKill.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
    }),
    prisma.scrimMercyRez.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
    }),
    prisma.scrimPointProgress.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
    }),
    prisma.scrimDefensiveAssist.findMany({
      where: { mapDataId: mapId },
      orderBy: { match_time: 'asc' },
    }),
    groupKillsIntoFights(mapId),
  ])

  if (!matchStart) {
    return NextResponse.json({ error: 'Map not found' }, { status: 404 })
  }

  const team1 = matchStart.team_1_name ?? 'Team 1'
  const team2 = matchStart.team_2_name ?? 'Team 2'

  // Build match events timeline
  type MatchEvent = {
    time: number; type: string; description: string;
    team?: string; player?: string; hero?: string; killCount?: number
  }
  const matchEvents: MatchEvent[] = []

  // Match start
  matchEvents.push({
    time: round(matchStart.match_time),
    type: 'match_start',
    description: `Match started on ${matchStart.map_name} (${matchStart.map_type})`,
  })

  // Round starts
  for (const rs of roundStarts) {
    matchEvents.push({
      time: round(rs.match_time),
      type: 'round_start',
      description: `Round ${rs.round_number} started`,
      team: rs.capturing_team,
    })
  }

  // Round ends
  for (const re of roundEnds) {
    matchEvents.push({
      time: round(re.match_time),
      type: 'round_end',
      description: `Round ${re.round_number} ended (${re.team_1_score} - ${re.team_2_score})`,
      team: re.capturing_team,
    })
  }

  // Objective captures
  for (const oc of objectivesCaptured) {
    matchEvents.push({
      time: round(oc.match_time),
      type: 'objective_captured',
      description: `${oc.capturing_team} captured objective ${oc.objective_index + 1}`,
      team: oc.capturing_team,
    })
  }

  // ── Multikills: group kills by attacker within each fight ──
  for (let fi = 0; fi < fights.length; fi++) {
    const fight = fights[fi]
    const attackerKills = new Map<string, { team: string; hero: string; count: number }>()
    for (const k of fight.kills) {
      if (k.event_ability === 'Resurrect') continue
      const key = k.attacker_name
      const existing = attackerKills.get(key)
      if (existing) {
        existing.count++
      } else {
        attackerKills.set(key, { team: k.attacker_team, hero: k.attacker_hero, count: 1 })
      }
    }
    for (const [name, info] of attackerKills) {
      if (info.count >= 3) {
        matchEvents.push({
          time: round(fight.start),
          type: 'multikill',
          description: `During fight ${fi + 1}, ${name} got a multikill, killing ${info.count} players.`,
          team: info.team,
          player: name,
          hero: info.hero,
          killCount: info.count,
        })
      }
    }
  }

  // ── Ultimate kills: kills that occurred during an ult window ──
  for (const us of ultStarts) {
    const ue = ultEnds.find(e =>
      e.ultimate_id === us.ultimate_id && e.player_name === us.player_name
    )
    const endTime = ue?.match_time ?? us.match_time + 10
    const ultKills = kills.filter(k =>
      k.attacker_name === us.player_name &&
      k.match_time >= us.match_time &&
      k.match_time <= endTime
    )
    if (ultKills.length > 0) {
      matchEvents.push({
        time: round(us.match_time),
        type: 'ultimate_kill',
        description: `${us.player_name} killed ${ultKills.length} player${ultKills.length !== 1 ? 's' : ''} with/during their ultimate.`,
        team: us.player_team,
        player: us.player_name,
        hero: us.player_hero,
        killCount: ultKills.length,
      })
    }
  }

  // ── Mercy rezzes ──
  for (const rez of mercyRezzes) {
    matchEvents.push({
      time: round(rez.match_time),
      type: 'mercy_rez',
      description: `${rez.resurrecter_player} resurrected ${rez.resurrectee_player}.`,
      team: rez.resurrecter_team,
      player: rez.resurrecter_player,
      hero: rez.resurrecter_hero,
    })
  }

  // ── Point control changes ──
  // Detect when capturing team changes by tracking consecutive entries
  let lastCapturingTeam = ''
  for (const pp of pointProgress) {
    if (pp.capturing_team && pp.capturing_team !== lastCapturingTeam) {
      matchEvents.push({
        time: round(pp.match_time),
        type: 'point_control',
        description: `${pp.capturing_team} took control of the point.`,
        team: pp.capturing_team,
      })
      lastCapturingTeam = pp.capturing_team
    }
  }

  matchEvents.sort((a, b) => a.time - b.time)

  // ── Build enriched ultimates timeline ──
  // Determine round boundaries for round grouping
  const roundBoundaries = roundStarts.map((rs, i) => ({
    roundNumber: rs.round_number,
    start: rs.match_time,
    end: roundEnds[i]?.match_time ?? Infinity,
  }))

  const ultimates = ultStarts.map(us => {
    const ue = ultEnds.find(e =>
      e.ultimate_id === us.ultimate_id && e.player_name === us.player_name
    )
    const endTime = ue?.match_time ?? null

    // Kills during ult window
    const ultWindow = endTime ?? us.match_time + 10
    const killsDuringUlt = kills.filter(k =>
      k.attacker_name === us.player_name &&
      k.match_time >= us.match_time &&
      k.match_time <= ultWindow
    ).length

    // Defensive assists (saves) during ult window
    const savesDuringUlt = defensiveAssists.filter(da =>
      da.player_name === us.player_name &&
      da.match_time >= us.match_time &&
      da.match_time <= ultWindow
    ).length

    // Determine round number
    const roundNum = roundBoundaries.find(rb =>
      us.match_time >= rb.start && us.match_time <= rb.end
    )?.roundNumber ?? null

    // Determine fight number
    let fightNum: number | null = null
    for (let fi = 0; fi < fights.length; fi++) {
      if (us.match_time >= fights[fi].start - 2 && us.match_time <= fights[fi].end + 2) {
        fightNum = fi + 1
        break
      }
    }

    return {
      time: round(us.match_time),
      team: us.player_team,
      player: us.player_name,
      hero: us.player_hero,
      ultimateId: us.ultimate_id,
      endTime: endTime ? round(endTime) : null,
      killsDuringUlt,
      savesDuringUlt,
      roundNumber: roundNum,
      fightNumber: fightNum,
    }
  })

  return NextResponse.json({
    teams: { team1, team2 },
    matchEvents,
    ultimates,
  })
}

async function getCompareData(mapId: number) {
  const [matchStart, playerStats] = await Promise.all([
    prisma.scrimMatchStart.findFirst({
      where: { mapDataId: mapId },
      select: { team_1_name: true, team_2_name: true },
    }),
    getFinalRoundStats(mapId),
  ])

  if (!matchStart) {
    return NextResponse.json({ error: 'Map not found' }, { status: 404 })
  }

  const team1 = matchStart.team_1_name ?? 'Team 1'
  const team2 = matchStart.team_2_name ?? 'Team 2'

  const formatPlayer = (p: typeof playerStats[0]) => ({
    name: p.player_name,
    team: p.player_team,
    hero: p.player_hero,
    eliminations: p.eliminations,
    deaths: p.deaths,
    finalBlows: p.final_blows,
    heroDamage: round(p.hero_damage_dealt),
    healingDealt: round(p.healing_dealt),
    damageTaken: round(p.damage_taken),
    damageBlocked: round(p.damage_blocked),
    assists: p.defensive_assists + p.offensive_assists,
    timePlayed: round(p.hero_time_played),
    ultimatesEarned: p.ultimates_earned,
    ultimatesUsed: p.ultimates_used,
    soloKills: p.solo_kills,
    objectiveKills: p.objective_kills,
    criticalHits: p.critical_hits,
    weaponAccuracy: round(p.weapon_accuracy),
  })

  return NextResponse.json({
    teams: { team1, team2 },
    team1Players: playerStats.filter(p => p.player_team === team1).map(formatPlayer),
    team2Players: playerStats.filter(p => p.player_team === team2).map(formatPlayer),
  })
}

// ── Hero → Role mapping (Overwatch 2) ──
const HERO_ROLES: Record<string, 'Tank' | 'Damage' | 'Support'> = {
  // Tanks
  'D.Va': 'Tank', 'Doomfist': 'Tank', 'Junker Queen': 'Tank', 'Mauga': 'Tank',
  'Orisa': 'Tank', 'Ramattra': 'Tank', 'Reinhardt': 'Tank', 'Roadhog': 'Tank',
  'Sigma': 'Tank', 'Winston': 'Tank', 'Wrecking Ball': 'Tank', 'Zarya': 'Tank', 'Hazard': 'Tank',
  // Damage
  'Ashe': 'Damage', 'Bastion': 'Damage', 'Cassidy': 'Damage', 'Echo': 'Damage',
  'Freja': 'Damage', 'Genji': 'Damage', 'Hanzo': 'Damage', 'Junkrat': 'Damage',
  'Mei': 'Damage', 'Pharah': 'Damage', 'Reaper': 'Damage', 'Sojourn': 'Damage',
  'Soldier: 76': 'Damage', 'Sombra': 'Damage', 'Symmetra': 'Damage', 'Torbjörn': 'Damage',
  'Tracer': 'Damage', 'Venture': 'Damage', 'Widowmaker': 'Damage',
  // Support
  'Ana': 'Support', 'Baptiste': 'Support', 'Brigitte': 'Support', 'Illari': 'Support',
  'Juno': 'Support', 'Kiriko': 'Support', 'Lifeweaver': 'Support', 'Lúcio': 'Support',
  'Mercy': 'Support', 'Moira': 'Support', 'Zenyatta': 'Support',
}

function getRoleForHero(hero: string): 'Tank' | 'Damage' | 'Support' {
  return HERO_ROLES[hero] ?? 'Damage'
}

async function getChartsData(mapId: number) {
  const [matchStart, playerStats] = await Promise.all([
    prisma.scrimMatchStart.findFirst({
      where: { mapDataId: mapId },
      select: { team_1_name: true, team_2_name: true },
    }),
    prisma.scrimPlayerStat.findMany({
      where: { mapDataId: mapId },
      select: {
        round_number: true,
        player_team: true,
        player_hero: true,
        final_blows: true,
        hero_damage_dealt: true,
      },
    }),
  ])

  if (!matchStart) {
    return NextResponse.json({ error: 'Map not found' }, { status: 404 })
  }

  const team1 = matchStart.team_1_name ?? 'Team 1'
  const team2 = matchStart.team_2_name ?? 'Team 2'

  // ── Final Blows By Role ──
  const roleData = { Tank: { team1: 0, team2: 0 }, Damage: { team1: 0, team2: 0 }, Support: { team1: 0, team2: 0 } }

  // Use the highest round_number stats (final) for each player
  const maxRound = Math.max(...playerStats.map(s => s.round_number), 0)
  const finalStats = playerStats.filter(s => s.round_number === maxRound)

  for (const stat of finalStats) {
    const role = getRoleForHero(stat.player_hero)
    if (stat.player_team === team1) {
      roleData[role].team1 += stat.final_blows
    } else {
      roleData[role].team2 += stat.final_blows
    }
  }

  // ── Cumulative Hero Damage By Round ──
  const rounds = [...new Set(playerStats.map(s => s.round_number))].sort((a, b) => a - b)
  const damageByRound = rounds.map(roundNum => {
    const roundStats = playerStats.filter(s => s.round_number === roundNum)
    const t1Damage = round(roundStats.filter(s => s.player_team === team1).reduce((a, s) => a + s.hero_damage_dealt, 0))
    const t2Damage = round(roundStats.filter(s => s.player_team === team2).reduce((a, s) => a + s.hero_damage_dealt, 0))
    return { round: roundNum, team1Damage: t1Damage, team2Damage: t2Damage }
  })

  return NextResponse.json({
    teams: { team1, team2 },
    finalBlowsByRole: {
      Tank: { team1: roleData.Tank.team1, team2: roleData.Tank.team2 },
      Damage: { team1: roleData.Damage.team1, team2: roleData.Damage.team2 },
      Support: { team1: roleData.Support.team1, team2: roleData.Support.team2 },
    },
    damageByRound,
  })
}
