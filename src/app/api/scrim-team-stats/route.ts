import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { groupKillsIntoFights } from '@/lib/scrim-parser/utils'
import { heroRoleMapping } from '@/lib/scrim-parser/heroes'

/**
 * GET /api/scrim-team-stats?teamId=N&range=last20|last50|last30d|all
 * Returns aggregated team-level scrim analytics from parsertime data.
 * Enhanced with Parsertime-inspired features: trends, heroes, teamfights,
 * role performance, player×map matrix, and strengths/weaknesses.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const teamIdStr = url.searchParams.get('teamId')

  if (!teamIdStr) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
  }
  const teamId = parseInt(teamIdStr)
  if (isNaN(teamId)) {
    return NextResponse.json({ error: 'teamId must be a number' }, { status: 400 })
  }

  // ── Range filter ──
  const range = url.searchParams.get('range') ?? 'last20'

  try {
    // ── 1. Resolve team name ──
    const teamRow = await prisma.$queryRaw<[{ name: string }]>`
      SELECT name FROM teams WHERE id = ${teamId} LIMIT 1
    `
    const teamName = teamRow?.[0]?.name ?? 'Unknown Team'

    // ── 2. Get all scrims for this team (either as primary or secondary team) ──
    const scrims = await prisma.scrim.findMany({
      where: {
        OR: [
          { payloadTeamId: teamId },
          { payloadTeamId2: teamId },
        ],
      },
      orderBy: { date: 'desc' },
      include: {
        maps: {
          select: {
            id: true,
            name: true,
            mapData: { select: { id: true } },
          },
        },
      },
    })

    const emptyResponse = {
      teamId, teamName,
      totalScrims: 0, totalMaps: 0,
      record: { wins: 0, losses: 0, draws: 0 },
      winRate: 0, avgMatchTime: null,
      recentScrims: [], mapStats: [], roster: [], opponents: [],
      trends: { weeklyWinRates: [], recentForm: [], streaks: { current: 0, currentType: null, longestWin: 0, longestLoss: 0 } },
      heroes: { totalUnique: 0, diversityScore: 0, heroPool: [], roleBreakdown: { Tank: 0, Damage: 0, Support: 0 } },
      teamfights: { totalFights: 0, fightWinRate: 0, firstPickWinRate: 0, firstDeathWinRate: 0, avgFightDuration: 0 },
      rolePerformance: [],
      playerMapMatrix: [],
      strengths: { best: null, worst: null },
    }

    if (scrims.length === 0) return NextResponse.json(emptyResponse)

    // ── 3. Collect all mapDataIds ──
    const allMapDataIds = scrims.flatMap(s =>
      s.maps.flatMap(m => m.mapData.map(md => md.id))
    )

    if (allMapDataIds.length === 0) {
      return NextResponse.json({
        ...emptyResponse,
        totalScrims: scrims.length,
        recentScrims: scrims.map(s => ({
          id: s.id, name: s.name, date: s.date.toISOString(),
          mapCount: s.maps.length, record: { wins: 0, losses: 0, draws: 0 },
          maps: [],
        })),
      })
    }

    // ── 4. Get match info (teams, scores, map types) for all maps ──
    type MapInfo = {
      mapDataId: number
      team1: string
      team2: string
      mapType: string | null
      mapName: string | null
      team1Score: number | null
      team2Score: number | null
      re_team1Score: number | null
      re_team2Score: number | null
      matchTime: number | null
    }
    const mapInfoRows = await prisma.$queryRaw<MapInfo[]>`
      SELECT
        ms."mapDataId" as "mapDataId",
        ms.team_1_name as team1,
        ms.team_2_name as team2,
        ms.map_type as "mapType",
        ms.map_name as "mapName",
        me.team_1_score as "team1Score",
        me.team_2_score as "team2Score",
        re.team_1_score as "re_team1Score",
        re.team_2_score as "re_team2Score",
        COALESCE(me.match_time, re.match_time) as "matchTime"
      FROM scrim_match_starts ms
      LEFT JOIN scrim_match_ends me ON me."mapDataId" = ms."mapDataId"
        AND me.round_number = (SELECT MAX(round_number) FROM scrim_match_ends WHERE "mapDataId" = ms."mapDataId")
      LEFT JOIN scrim_round_ends re ON re."mapDataId" = ms."mapDataId"
        AND re.round_number = (SELECT MAX(round_number) FROM scrim_round_ends WHERE "mapDataId" = ms."mapDataId")
      WHERE ms."mapDataId" = ANY(${allMapDataIds}::int[])
    `

    const mapInfoMap = new Map<number, MapInfo>()
    for (const row of mapInfoRows) {
      mapInfoMap.set(row.mapDataId, row)
    }

    // ── 5. Identify "our" team raw name per mapDataId ──
    // Use roster membership to correctly identify our team, especially for dual-team scrims
    // where both teams may have players with personId set.
    const ourTeamRows = await prisma.$queryRaw<Array<{ mapDataId: number; player_team: string }>>`
      SELECT DISTINCT ps."mapDataId" as "mapDataId", ps.player_team
      FROM scrim_player_stats ps
      JOIN teams_roster tr ON tr.person_id = ps."personId"
      WHERE ps."mapDataId" = ANY(${allMapDataIds}::int[])
        AND ps."personId" IS NOT NULL
        AND tr."_parent_id" = ${teamId}
    `
    const ourTeamByMap = new Map<number, string>()
    for (const r of ourTeamRows) {
      if (r.mapDataId && !ourTeamByMap.has(r.mapDataId)) {
        ourTeamByMap.set(r.mapDataId, r.player_team)
      }
    }

    // ── 6. Compute per-map results ──
    type MapResult = {
      mapDataId: number
      mapName: string
      mapType: string
      opponent: string
      score: string | null
      result: 'win' | 'loss' | 'draw' | null
      matchTime: number | null
      scrimId: number
      scrimDate: Date
    }
    // Build mapDataId → scrim lookup
    const mapDataToScrim = new Map<number, { id: number; date: Date }>()
    for (const s of scrims) {
      for (const m of s.maps) {
        for (const md of m.mapData) {
          mapDataToScrim.set(md.id, { id: s.id, date: s.date })
        }
      }
    }

    // Build scrim-level opponent name override lookup
    const scrimOpponentOverride = new Map<number, string>()
    for (const s of scrims) {
      if (s.opponentName) {
        scrimOpponentOverride.set(s.id, s.opponentName)
      }
    }

    const mapResults: MapResult[] = []
    for (const [mapDataId, info] of mapInfoMap) {
      const ourTeam = ourTeamByMap.get(mapDataId) ?? info.team1
      let opponent = ourTeam === info.team1 ? info.team2 : info.team1

      // Prefer scrim-level opponent name override
      const scrimInfo = mapDataToScrim.get(mapDataId)
      if (scrimInfo && scrimOpponentOverride.has(scrimInfo.id)) {
        opponent = scrimOpponentOverride.get(scrimInfo.id)!
      }

      const t1 = info.team1Score ?? info.re_team1Score
      const t2 = info.team2Score ?? info.re_team2Score

      let score: string | null = null
      let result: 'win' | 'loss' | 'draw' | null = null
      if (t1 != null && t2 != null) {
        const ourScore = ourTeam === info.team1 ? t1 : t2
        const theirScore = ourTeam === info.team1 ? t2 : t1
        score = `${ourScore}-${theirScore}`
        if (ourScore > theirScore) result = 'win'
        else if (ourScore < theirScore) result = 'loss'
        else result = 'draw'
      }

      mapResults.push({
        mapDataId,
        mapName: info.mapName ?? 'Unknown',
        mapType: info.mapType ?? 'Unknown',
        opponent,
        score,
        result,
        matchTime: info.matchTime ? Number(info.matchTime) : null,
        scrimId: scrimInfo?.id ?? 0,
        scrimDate: scrimInfo?.date ?? new Date(),
      })
    }

    // ── 6b. Apply range filter to mapResults ──
    mapResults.sort((a, b) => b.scrimDate.getTime() - a.scrimDate.getTime())
    if (range === 'last20') {
      mapResults.splice(20)
    } else if (range === 'last50') {
      mapResults.splice(50)
    } else if (range === 'last30d') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const filtered = mapResults.filter(mr => mr.scrimDate >= cutoff)
      mapResults.length = 0
      mapResults.push(...filtered)
    }
    // 'all' = no filtering

    // Narrow mapDataIds to only the filtered set
    const filteredMapDataIds = mapResults.map(mr => mr.mapDataId)

    // ── 7. Aggregate record ──
    const record = { wins: 0, losses: 0, draws: 0 }
    for (const mr of mapResults) {
      if (mr.result === 'win') record.wins++
      else if (mr.result === 'loss') record.losses++
      else if (mr.result === 'draw') record.draws++
    }
    const totalPlayed = record.wins + record.losses + record.draws
    const winRate = totalPlayed > 0 ? Math.round((record.wins / totalPlayed) * 100) : 0

    // ── 8. Map stats (per-map aggregation) ──
    const mapAgg = new Map<string, { wins: number; losses: number; draws: number; mapType: string; totalTime: number; count: number }>()
    for (const mr of mapResults) {
      const key = mr.mapName
      if (!mapAgg.has(key)) {
        mapAgg.set(key, { wins: 0, losses: 0, draws: 0, mapType: mr.mapType, totalTime: 0, count: 0 })
      }
      const agg = mapAgg.get(key)!
      if (mr.result === 'win') agg.wins++
      else if (mr.result === 'loss') agg.losses++
      else if (mr.result === 'draw') agg.draws++
      if (mr.matchTime) { agg.totalTime += mr.matchTime; agg.count++ }
    }
    const mapStats = Array.from(mapAgg.entries()).map(([mapName, stats]) => {
      const total = stats.wins + stats.losses + stats.draws
      return {
        mapName,
        mapType: stats.mapType,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        played: total,
        winRate: total > 0 ? Math.round((stats.wins / total) * 100) : 0,
        avgTime: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : null,
      }
    }).sort((a, b) => b.played - a.played)

    // ── 9. Roster stats (per-player aggregation) ──
    type RawPlayerStat = {
      personId: number | null
      player_name: string
      player_team: string
      player_hero: string
      eliminations: number
      final_blows: number
      deaths: number
      hero_damage_dealt: number
      healing_dealt: number
      hero_time_played: number
      all_damage_dealt: number
      solo_kills: number
      ultimates_earned: number
      ultimates_used: number
      mapDataId: number
    }
    const playerStats = await prisma.$queryRaw<RawPlayerStat[]>`
      SELECT
        ps."personId",
        ps.player_name,
        ps.player_team,
        ps.player_hero,
        ps.eliminations,
        ps.final_blows,
        ps.deaths,
        ps.hero_damage_dealt,
        ps.healing_dealt,
        ps.hero_time_played,
        ps.all_damage_dealt,
        ps.solo_kills,
        ps.ultimates_earned,
        ps.ultimates_used,
        ps."mapDataId"
      FROM scrim_player_stats ps
      WHERE ps."mapDataId" = ANY(${filteredMapDataIds}::int[])
        AND ps."personId" IS NOT NULL
        AND ps.round_number = (
          SELECT MAX(ps2.round_number)
          FROM scrim_player_stats ps2
          WHERE ps2."mapDataId" = ps."mapDataId"
        )
        AND ps."personId" IN (
          SELECT tr.person_id FROM teams_roster tr WHERE tr."_parent_id" = ${teamId}
        )
    `

    // Resolve person names
    const personIds = [...new Set(playerStats.map(p => p.personId).filter(Boolean))] as number[]
    const personNameMap = new Map<number, string>()
    if (personIds.length > 0) {
      const personRows = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
        SELECT id, name FROM people WHERE id = ANY(${personIds}::int[])
      `
      for (const p of personRows) {
        personNameMap.set(p.id, p.name)
      }
    }

    // Aggregate per player
    type PlayerAgg = {
      personId: number
      name: string
      maps: number
      totalTime: number
      elims: number
      deaths: number
      damage: number
      healing: number
      finalBlows: number
      soloKills: number
      ultsEarned: number
      ultsUsed: number
      heroes: Map<string, number>
      mapIds: Set<number>
    }
    const playerAggMap = new Map<number, PlayerAgg>()
    for (const ps of playerStats) {
      if (!ps.personId) continue
      if (!playerAggMap.has(ps.personId)) {
        playerAggMap.set(ps.personId, {
          personId: ps.personId,
          name: personNameMap.get(ps.personId) ?? ps.player_name,
          maps: 0, totalTime: 0, elims: 0, deaths: 0, damage: 0, healing: 0,
          finalBlows: 0, soloKills: 0, ultsEarned: 0, ultsUsed: 0,
          heroes: new Map(), mapIds: new Set(),
        })
      }
      const agg = playerAggMap.get(ps.personId)!
      agg.totalTime += Number(ps.hero_time_played) || 0
      agg.elims += ps.eliminations
      agg.deaths += ps.deaths
      agg.damage += Number(ps.hero_damage_dealt) || 0
      agg.healing += Number(ps.healing_dealt) || 0
      agg.finalBlows += ps.final_blows
      agg.soloKills += ps.solo_kills
      agg.ultsEarned += ps.ultimates_earned
      agg.ultsUsed += ps.ultimates_used
      agg.mapIds.add(ps.mapDataId)
      const heroTime = agg.heroes.get(ps.player_hero) ?? 0
      agg.heroes.set(ps.player_hero, heroTime + (Number(ps.hero_time_played) || 0))
    }

    const roster = Array.from(playerAggMap.values()).map(p => {
      const minutes10 = p.totalTime / 600
      const topHeroes = Array.from(p.heroes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hero, time]) => ({ hero, time: Math.round(time) }))

      return {
        personId: p.personId,
        name: p.name,
        mapsPlayed: p.mapIds.size,
        totalTime: Math.round(p.totalTime),
        elimsPer10: minutes10 > 0 ? Math.round((p.elims / minutes10) * 10) / 10 : 0,
        deathsPer10: minutes10 > 0 ? Math.round((p.deaths / minutes10) * 10) / 10 : 0,
        damagePer10: minutes10 > 0 ? Math.round(p.damage / minutes10) : 0,
        healingPer10: minutes10 > 0 ? Math.round(p.healing / minutes10) : 0,
        fbPer10: minutes10 > 0 ? Math.round((p.finalBlows / minutes10) * 10) / 10 : 0,
        kd: p.deaths > 0 ? Math.round((p.elims / p.deaths) * 100) / 100 : p.elims,
        topHeroes,
      }
    }).sort((a, b) => b.mapsPlayed - a.mapsPlayed || b.elimsPer10 - a.elimsPer10)

    // ── 10. Opponent stats ──
    const opponentAgg = new Map<string, {
      name: string; wins: number; losses: number; draws: number;
      maps: Array<{ mapName: string; result: string }>; lastDate: Date | null;
    }>()
    for (const s of scrims) {
      for (const m of s.maps) {
        for (const md of m.mapData) {
          const mr = mapResults.find(r => r.mapDataId === md.id)
          if (!mr) continue
          const key = mr.opponent
          if (!opponentAgg.has(key)) {
            opponentAgg.set(key, { name: key, wins: 0, losses: 0, draws: 0, maps: [], lastDate: null })
          }
          const opp = opponentAgg.get(key)!
          if (mr.result === 'win') opp.wins++
          else if (mr.result === 'loss') opp.losses++
          else if (mr.result === 'draw') opp.draws++
          opp.maps.push({ mapName: mr.mapName, result: mr.result ?? 'unknown' })
          if (!opp.lastDate || s.date > opp.lastDate) opp.lastDate = s.date
        }
      }
    }
    const opponents = Array.from(opponentAgg.values())
      .map(o => ({
        name: o.name, wins: o.wins, losses: o.losses, draws: o.draws,
        totalMaps: o.wins + o.losses + o.draws,
        winRate: (o.wins + o.losses + o.draws) > 0
          ? Math.round((o.wins / (o.wins + o.losses + o.draws)) * 100) : 0,
        lastPlayed: o.lastDate?.toISOString() ?? null,
      }))
      .sort((a, b) => b.totalMaps - a.totalMaps)

    // ── 11. Recent scrims ──
    const recentScrims = scrims.slice(0, 10).map(s => {
      const scrimMapResults = s.maps.flatMap(m =>
        m.mapData.map(md => mapResults.find(r => r.mapDataId === md.id))
      ).filter(Boolean) as MapResult[]

      const scrimRecord = { wins: 0, losses: 0, draws: 0 }
      for (const mr of scrimMapResults) {
        if (mr.result === 'win') scrimRecord.wins++
        else if (mr.result === 'loss') scrimRecord.losses++
        else if (mr.result === 'draw') scrimRecord.draws++
      }

      return {
        id: s.id, name: s.name, date: s.date.toISOString(),
        mapCount: s.maps.length, record: scrimRecord,
        maps: scrimMapResults.map(mr => ({
          mapDataId: mr.mapDataId, mapName: mr.mapName, mapType: mr.mapType,
          opponent: mr.opponent, score: mr.score, result: mr.result,
        })),
      }
    })

    // ── 12. Avg match time ──
    const allMatchTimes = mapResults.filter(mr => mr.matchTime).map(mr => mr.matchTime!)
    const avgMatchTime = allMatchTimes.length > 0
      ? Math.round(allMatchTimes.reduce((a, b) => a + b, 0) / allMatchTimes.length)
      : null

    // ════════════════════════════════════════════════════════════════
    // ── NEW: Parsertime-Inspired Analytics ──
    // ════════════════════════════════════════════════════════════════

    // ── 13. Trends: Win rate over time + recent form + streaks ──
    const sortedByDate = [...mapResults]
      .filter(mr => mr.result)
      .sort((a, b) => a.scrimDate.getTime() - b.scrimDate.getTime())

    // Weekly win rates
    const weeklyMap = new Map<string, { wins: number; losses: number; draws: number }>()
    for (const mr of sortedByDate) {
      const d = mr.scrimDate
      // ISO week key: YYYY-WNN
      const oneJan = new Date(d.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
      if (!weeklyMap.has(key)) weeklyMap.set(key, { wins: 0, losses: 0, draws: 0 })
      const w = weeklyMap.get(key)!
      if (mr.result === 'win') w.wins++
      else if (mr.result === 'loss') w.losses++
      else if (mr.result === 'draw') w.draws++
    }
    const weeklyWinRates = Array.from(weeklyMap.entries()).map(([week, r]) => {
      const t = r.wins + r.losses + r.draws
      return { week, wins: r.wins, losses: r.losses, draws: r.draws, total: t, winRate: t > 0 ? Math.round((r.wins / t) * 100) : 0 }
    })

    // Recent form (last 20 map results, newest first)
    const recentResults = [...sortedByDate].reverse().slice(0, 20)
    const recentForm = recentResults.map(mr => ({
      mapName: mr.mapName,
      mapType: mr.mapType,
      opponent: mr.opponent,
      result: mr.result,
      score: mr.score,
      date: mr.scrimDate.toISOString(),
    }))

    // Streaks
    let currentStreak = 0
    let currentType: 'win' | 'loss' | null = null
    let longestWin = 0
    let longestLoss = 0
    let tempWin = 0
    let tempLoss = 0
    for (const mr of [...sortedByDate].reverse()) {
      if (mr.result === 'win') {
        tempWin++
        tempLoss = 0
        if (currentType === null) { currentType = 'win'; currentStreak = 1 }
        else if (currentType === 'win') currentStreak++
        longestWin = Math.max(longestWin, tempWin)
      } else if (mr.result === 'loss') {
        tempLoss++
        tempWin = 0
        if (currentType === null) { currentType = 'loss'; currentStreak = 1 }
        else if (currentType === 'loss') currentStreak++
        longestLoss = Math.max(longestLoss, tempLoss)
      } else {
        tempWin = 0
        tempLoss = 0
        if (currentType === null) currentType = null
      }
    }

    const trends = {
      weeklyWinRates,
      recentForm,
      streaks: { current: currentStreak, currentType, longestWin, longestLoss },
    }

    // ── 14. Heroes: Hero pool overview + diversity + role breakdown ──
    const heroAgg = new Map<string, { hero: string; time: number; maps: Set<number>; wins: number; losses: number; draws: number }>()
    for (const ps of playerStats) {
      if (!ps.personId) continue
      const hero = ps.player_hero
      if (!heroAgg.has(hero)) {
        heroAgg.set(hero, { hero, time: 0, maps: new Set(), wins: 0, losses: 0, draws: 0 })
      }
      const h = heroAgg.get(hero)!
      h.time += Number(ps.hero_time_played) || 0
      h.maps.add(ps.mapDataId)
      // Get result for this map
      const mr = mapResults.find(r => r.mapDataId === ps.mapDataId)
      if (mr?.result === 'win') h.wins++
      else if (mr?.result === 'loss') h.losses++
      else if (mr?.result === 'draw') h.draws++
    }

    const heroPool = Array.from(heroAgg.values())
      .map(h => {
        const total = h.wins + h.losses + h.draws
        const role = (heroRoleMapping as Record<string, string>)[h.hero] ?? 'Damage'
        return {
          hero: h.hero,
          role,
          totalTime: Math.round(h.time),
          mapsPlayed: h.maps.size,
          wins: h.wins,
          losses: h.losses,
          draws: h.draws,
          winRate: total > 0 ? Math.round((h.wins / total) * 100) : 0,
        }
      })
      .sort((a, b) => b.totalTime - a.totalTime)

    const totalUniqueHeroes = heroPool.length
    const totalAvailableHeroes = Object.keys(heroRoleMapping).length
    const diversityScore = totalAvailableHeroes > 0 ? Math.round((totalUniqueHeroes / totalAvailableHeroes) * 100) : 0

    const roleBreakdown = { Tank: 0, Damage: 0, Support: 0 }
    for (const h of heroPool) {
      if (h.role === 'Tank') roleBreakdown.Tank++
      else if (h.role === 'Support') roleBreakdown.Support++
      else roleBreakdown.Damage++
    }

    const heroes = { totalUnique: totalUniqueHeroes, diversityScore, heroPool, roleBreakdown }

    // ── 15. Teamfights: Fight analysis across all maps ──
    let totalFights = 0
    let fightsWon = 0
    let firstPickWins = 0
    let firstPickTotal = 0
    let firstDeathWins = 0
    let firstDeathTotal = 0
    let totalFightDuration = 0

    // Process fights for each mapDataId
    for (const mapDataId of filteredMapDataIds) {
      const ourTeam = ourTeamByMap.get(mapDataId)
      if (!ourTeam) continue

      const mr = mapResults.find(r => r.mapDataId === mapDataId)
      if (!mr) continue

      try {
        const fights = await groupKillsIntoFights(mapDataId)
        for (const fight of fights) {
          if (fight.kills.length < 2) continue // Skip trivial fights
          totalFights++
          totalFightDuration += fight.end - fight.start

          // Determine fight winner: team with more kills
          let ourKills = 0
          let theirKills = 0
          for (const k of fight.kills) {
            if (k.event_ability === 'Resurrect') continue
            if (k.attacker_team === ourTeam) ourKills++
            else theirKills++
          }
          const weWon = ourKills > theirKills

          if (weWon) fightsWon++

          // First pick analysis
          const firstKill = fight.kills.find(k => k.event_ability !== 'Resurrect')
          if (firstKill) {
            const weGotFirstPick = firstKill.attacker_team === ourTeam
            const weGotFirstDeath = firstKill.victim_team === ourTeam

            if (weGotFirstPick) {
              firstPickTotal++
              if (weWon) firstPickWins++
            }
            if (weGotFirstDeath) {
              firstDeathTotal++
              if (weWon) firstDeathWins++
            }
          }
        }
      } catch {
        // Skip maps where fight grouping fails
      }
    }

    const teamfights = {
      totalFights,
      fightWinRate: totalFights > 0 ? Math.round((fightsWon / totalFights) * 100) : 0,
      firstPickWinRate: firstPickTotal > 0 ? Math.round((firstPickWins / firstPickTotal) * 100) : 0,
      firstDeathWinRate: firstDeathTotal > 0 ? Math.round((firstDeathWins / firstDeathTotal) * 100) : 0,
      avgFightDuration: totalFights > 0 ? Math.round(totalFightDuration / totalFights * 10) / 10 : 0,
      firstPickTotal,
      firstDeathTotal,
      fightsWon,
    }

    // ── 16. Role Performance ──
    type RoleAgg = {
      role: string; totalTime: number; maps: Set<number>;
      elims: number; deaths: number; damage: number; healing: number;
      finalBlows: number; ultsEarned: number; ultsUsed: number;
    }
    const roleAggMap = new Map<string, RoleAgg>()
    for (const ps of playerStats) {
      if (!ps.personId) continue
      const role = (heroRoleMapping as Record<string, string>)[ps.player_hero] ?? 'Damage'
      if (!roleAggMap.has(role)) {
        roleAggMap.set(role, {
          role, totalTime: 0, maps: new Set(),
          elims: 0, deaths: 0, damage: 0, healing: 0,
          finalBlows: 0, ultsEarned: 0, ultsUsed: 0,
        })
      }
      const r = roleAggMap.get(role)!
      r.totalTime += Number(ps.hero_time_played) || 0
      r.maps.add(ps.mapDataId)
      r.elims += ps.eliminations
      r.deaths += ps.deaths
      r.damage += Number(ps.hero_damage_dealt) || 0
      r.healing += Number(ps.healing_dealt) || 0
      r.finalBlows += ps.final_blows
      r.ultsEarned += ps.ultimates_earned
      r.ultsUsed += ps.ultimates_used
    }

    const rolePerformance = Array.from(roleAggMap.values()).map(r => {
      const m10 = r.totalTime / 600
      return {
        role: r.role,
        totalTime: Math.round(r.totalTime),
        mapsPlayed: r.maps.size,
        kd: r.deaths > 0 ? Math.round((r.elims / r.deaths) * 100) / 100 : r.elims,
        damagePer10: m10 > 0 ? Math.round(r.damage / m10) : 0,
        healingPer10: m10 > 0 ? Math.round(r.healing / m10) : 0,
        deathsPer10: m10 > 0 ? Math.round((r.deaths / m10) * 10) / 10 : 0,
        elimsPer10: m10 > 0 ? Math.round((r.elims / m10) * 10) / 10 : 0,
        ultEfficiency: r.ultsUsed > 0 ? Math.round((r.elims / r.ultsUsed) * 100) / 100 : 0,
        totalElims: r.elims,
        totalDeaths: r.deaths,
        ultsEarned: r.ultsEarned,
        ultsUsed: r.ultsUsed,
      }
    }).sort((a, b) => {
      const order: Record<string, number> = { Tank: 0, Damage: 1, Support: 2 }
      return (order[a.role] ?? 3) - (order[b.role] ?? 3)
    })

    // ── 17. Player × Map Performance Matrix ──
    // For each player+map combo, compute W/L/D
    const playerMapAgg = new Map<string, { personId: number; playerName: string; mapName: string; wins: number; losses: number; draws: number }>()
    for (const ps of playerStats) {
      if (!ps.personId) continue
      const mr = mapResults.find(r => r.mapDataId === ps.mapDataId)
      if (!mr || !mr.result) continue
      const key = `${ps.personId}__${mr.mapName}`
      if (!playerMapAgg.has(key)) {
        playerMapAgg.set(key, {
          personId: ps.personId,
          playerName: personNameMap.get(ps.personId) ?? ps.player_name,
          mapName: mr.mapName,
          wins: 0, losses: 0, draws: 0,
        })
      }
      const agg = playerMapAgg.get(key)!
      // Avoid double-counting (multiple hero rows per map for same player)
      // Use a dedup set per key-mapDataId
    }
    // Rebuild with dedup
    const playerMapDedup = new Map<string, Set<number>>()
    const playerMapResult = new Map<string, { personId: number; playerName: string; mapName: string; wins: number; losses: number; draws: number }>()
    for (const ps of playerStats) {
      if (!ps.personId) continue
      const mr = mapResults.find(r => r.mapDataId === ps.mapDataId)
      if (!mr || !mr.result) continue
      const key = `${ps.personId}__${mr.mapName}`
      const dedupKey = `${key}__${ps.mapDataId}`

      if (!playerMapDedup.has(key)) playerMapDedup.set(key, new Set())
      if (playerMapDedup.get(key)!.has(ps.mapDataId)) continue
      playerMapDedup.get(key)!.add(ps.mapDataId)

      if (!playerMapResult.has(key)) {
        playerMapResult.set(key, {
          personId: ps.personId,
          playerName: personNameMap.get(ps.personId) ?? ps.player_name,
          mapName: mr.mapName,
          wins: 0, losses: 0, draws: 0,
        })
      }
      const agg = playerMapResult.get(key)!
      if (mr.result === 'win') agg.wins++
      else if (mr.result === 'loss') agg.losses++
      else if (mr.result === 'draw') agg.draws++
    }

    const playerMapMatrix = Array.from(playerMapResult.values()).map(pm => {
      const total = pm.wins + pm.losses + pm.draws
      return {
        ...pm,
        totalMaps: total,
        winRate: total > 0 ? Math.round((pm.wins / total) * 100) : 0,
      }
    })

    // ── 18. Strengths & Weaknesses ──
    const mapsWithEnoughData = mapStats.filter(m => m.played >= 2)
    const bestMap = mapsWithEnoughData.length > 0
      ? mapsWithEnoughData.reduce((best, m) => m.winRate > best.winRate ? m : best)
      : mapStats[0] ?? null
    const worstMap = mapsWithEnoughData.length > 0
      ? mapsWithEnoughData.reduce((worst, m) => m.winRate < worst.winRate ? m : worst)
      : null

    const strengths = {
      best: bestMap ? { mapName: bestMap.mapName, mapType: bestMap.mapType, winRate: bestMap.winRate, played: bestMap.played } : null,
      worst: worstMap && worstMap.mapName !== bestMap?.mapName
        ? { mapName: worstMap.mapName, mapType: worstMap.mapType, winRate: worstMap.winRate, played: worstMap.played }
        : null,
    }

    // ── Final Response ──
    return NextResponse.json({
      teamId,
      teamName,
      totalScrims: scrims.length,
      totalMaps: mapResults.length,
      record,
      winRate,
      avgMatchTime,
      recentScrims,
      mapStats,
      roster,
      opponents,
      // New Parsertime-inspired fields
      trends,
      heroes,
      teamfights,
      rolePerformance,
      playerMapMatrix,
      strengths,
    })
  } catch (error) {
    console.error('Scrim team stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch team stats' }, { status: 500 })
  }
}
