import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { round } from '@/lib/scrim-parser/utils'
import { calculateStats } from '@/lib/scrim-parser/calculate-stats'
import { loadHeroPortraits, heroNameToSlug } from '@/lib/scrim-parser/heroIcons'

// ────────────────────────────────────────────────────────────────────────
// GET /api/player-stats
//   → Returns list of all players with career totals
//
// GET /api/player-stats?player=Lilly
//   → Returns detailed stats for a single player across all maps
// ────────────────────────────────────────────────────────────────────────

type PlayerListRow = {
  player_name: string
  player_team: string
  maps_played: number
  total_elims: number
  total_deaths: number
  total_damage: number
  total_healing: number
  total_fb: number
  most_played_hero: string
}

type PlayerMapRow = {
  mapDataId: number
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
  hero_time_played: number
  defensive_assists: number
  offensive_assists: number
  ultimates_earned: number
  ultimates_used: number
  solo_kills: number
  objective_kills: number
  environmental_kills: number
  environmental_deaths: number
  critical_hits: number
  critical_hit_accuracy: number
  weapon_accuracy: number
  multikill_best: number
  multikills: number
  scoped_accuracy: number
}

type MapInfoRow = {
  mapDataId: number
  map_name: string
  map_type: string
  scrim_name: string
  scrim_date: Date
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const playerName = url.searchParams.get('player')

  if (!playerName) {
    return getPlayerList()
  }

  return getPlayerDetail(playerName)
}

// ── Player List ─────────────────────────────────────────

async function getPlayerList() {
  // Aggregate career stats per player using final-round stats
  const players = await prisma.$queryRaw<PlayerListRow[]>`
    WITH final_stats AS (
      -- Get the final round stats per map (max match_time per mapDataId)
      SELECT ps.*
      FROM scrim_player_stats ps
      INNER JOIN (
        SELECT "mapDataId", MAX(match_time) as max_time
        FROM scrim_player_stats
        GROUP BY "mapDataId"
      ) mx ON ps."mapDataId" = mx."mapDataId" AND ps.match_time = mx.max_time
    ),
    -- Deduplicate (same player+hero in same map at same time)
    deduped AS (
      SELECT DISTINCT ON (player_name, player_hero, "mapDataId")
        *
      FROM final_stats
      ORDER BY player_name, player_hero, "mapDataId", id DESC
    ),
    -- Most played hero per player (by total hero_time_played)
    hero_ranks AS (
      SELECT player_name, player_hero,
        ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY SUM(hero_time_played) DESC) as rn
      FROM deduped
      GROUP BY player_name, player_hero
    )
    SELECT
      d.player_name,
      -- Use the most recent team name
      (SELECT player_team FROM deduped WHERE player_name = d.player_name ORDER BY "mapDataId" DESC LIMIT 1) as player_team,
      COUNT(DISTINCT d."mapDataId")::int as maps_played,
      SUM(d.eliminations)::int as total_elims,
      SUM(d.deaths)::int as total_deaths,
      SUM(d.hero_damage_dealt)::float as total_damage,
      SUM(d.healing_dealt)::float as total_healing,
      SUM(d.final_blows)::int as total_fb,
      hr.player_hero as most_played_hero
    FROM deduped d
    JOIN hero_ranks hr ON hr.player_name = d.player_name AND hr.rn = 1
    GROUP BY d.player_name, hr.player_hero
    ORDER BY maps_played DESC, d.player_name
  `

  return NextResponse.json({
    players: players.map((p) => ({
      name: p.player_name,
      team: p.player_team,
      mapsPlayed: Number(p.maps_played),
      eliminations: Number(p.total_elims),
      deaths: Number(p.total_deaths),
      damage: round(Number(p.total_damage)),
      healing: round(Number(p.total_healing)),
      finalBlows: Number(p.total_fb),
      mostPlayedHero: p.most_played_hero,
    })),
  })
}

// ── Player Detail ───────────────────────────────────────

async function getPlayerDetail(playerName: string) {
  // Get all maps this player has played on (final round stats)
  const playerMaps = await prisma.$queryRaw<PlayerMapRow[]>`
    WITH final_stats AS (
      SELECT ps.*
      FROM scrim_player_stats ps
      INNER JOIN (
        SELECT "mapDataId", MAX(match_time) as max_time
        FROM scrim_player_stats
        GROUP BY "mapDataId"
      ) mx ON ps."mapDataId" = mx."mapDataId" AND ps.match_time = mx.max_time
    )
    SELECT DISTINCT ON (player_name, player_hero, "mapDataId")
      "mapDataId",
      player_hero,
      eliminations,
      final_blows,
      deaths,
      all_damage_dealt,
      barrier_damage_dealt,
      hero_damage_dealt,
      healing_dealt,
      healing_received,
      self_healing,
      damage_taken,
      damage_blocked,
      hero_time_played,
      defensive_assists,
      offensive_assists,
      ultimates_earned,
      ultimates_used,
      solo_kills,
      objective_kills,
      environmental_kills,
      environmental_deaths,
      critical_hits,
      critical_hit_accuracy,
      weapon_accuracy,
      multikill_best,
      multikills,
      scoped_accuracy
    FROM final_stats
    WHERE player_name = ${playerName}
    ORDER BY player_name, player_hero, "mapDataId", id DESC
  `

  if (playerMaps.length === 0) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  // Get map info (map name, type, scrim name, date) for each map
  const mapDataIds = [...new Set(playerMaps.map((m) => m.mapDataId))]

  const mapInfoResults = await Promise.all(
    mapDataIds.map(async (mdId) => {
      const info = await prisma.$queryRaw<MapInfoRow[]>`
        SELECT
          md.id as "mapDataId",
          ms.map_name,
          ms.map_type,
          s.name as scrim_name,
          s.date as scrim_date
        FROM scrim_map_data md
        JOIN scrim_maps sm ON md."mapId" = sm.id
        JOIN scrim_scrims s ON sm."scrimId" = s.id
        JOIN scrim_match_starts ms ON ms."mapDataId" = md.id
        WHERE md.id = ${mdId}
        LIMIT 1
      `
      return info[0] ?? null
    })
  )

  const mapInfoMap = new Map(
    mapInfoResults.filter(Boolean).map((info) => [
      info!.mapDataId,
      {
        mapName: info!.map_name,
        mapType: info!.map_type,
        scrimName: info!.scrim_name,
        scrimDate: info!.scrim_date,
      },
    ])
  )

  // Calculate advanced stats for each map in parallel
  const advancedStats = await Promise.all(
    mapDataIds.map(async (mdId) => {
      try {
        const stats = await calculateStats(mdId, playerName)
        return { mapDataId: mdId, stats }
      } catch {
        return { mapDataId: mdId, stats: null }
      }
    })
  )
  const advancedStatsMap = new Map(advancedStats.map((a) => [a.mapDataId, a.stats]))

  // Build per-map rows: aggregate all hero rows per map
  const mapGroups = new Map<number, PlayerMapRow[]>()
  for (const row of playerMaps) {
    const group = mapGroups.get(row.mapDataId) ?? []
    group.push(row)
    mapGroups.set(row.mapDataId, group)
  }

  const maps = [...mapGroups.entries()].map(([mdId, rows]) => {
    const info = mapInfoMap.get(mdId)
    const advanced = advancedStatsMap.get(mdId)
    const totalElims = rows.reduce((a, r) => a + r.eliminations, 0)
    const totalFB = rows.reduce((a, r) => a + r.final_blows, 0)
    const totalDeaths = rows.reduce((a, r) => a + r.deaths, 0)
    const totalDamage = rows.reduce((a, r) => a + r.hero_damage_dealt, 0)
    const totalHealing = rows.reduce((a, r) => a + r.healing_dealt, 0)
    // Most played hero by time on this map
    const mainHero = rows.sort((a, b) => b.hero_time_played - a.hero_time_played)[0]?.player_hero ?? 'Unknown'

    return {
      mapDataId: mdId,
      mapName: info?.mapName ?? 'Unknown',
      mapType: info?.mapType ?? 'Unknown',
      scrimName: info?.scrimName ?? 'Unknown',
      scrimDate: info?.scrimDate ?? new Date(),
      hero: mainHero,
      eliminations: totalElims,
      finalBlows: totalFB,
      deaths: totalDeaths,
      damage: round(totalDamage),
      healing: round(totalHealing),
      // Advanced stats
      firstPickPct: advanced?.firstPickPercentage ?? 0,
      firstDeathPct: advanced?.firstDeathPercentage ?? 0,
      fletaPct: advanced?.fletaDeadliftPercentage ?? 0,
      ultCharge: advanced?.averageUltChargeTime ?? 0,
      ultHold: advanced?.averageTimeToUseUlt ?? 0,
      kPerUlt: advanced?.killsPerUltimate ?? 0,
      drought: advanced?.droughtTime ?? 0,
    }
  })

  // Sort by date descending
  maps.sort((a, b) => new Date(b.scrimDate).getTime() - new Date(a.scrimDate).getTime())

  // Hero pool: aggregate per hero across all maps
  type HeroAgg = {
    maps: Set<number>; elims: number; deaths: number; damage: number; healing: number; time: number; fb: number;
    allDamage: number; barrierDamage: number; healingReceived: number; selfHealing: number;
    damageTaken: number; damageBlocked: number; defAssists: number; offAssists: number;
    ultsEarned: number; ultsUsed: number; soloKills: number; objKills: number;
    envKills: number; envDeaths: number; critHits: number; critAccuracy: number;
    weaponAccuracy: number; multikillBest: number; multikills: number; scopedAccuracy: number;
  }
  const heroStats = new Map<string, HeroAgg>()
  for (const row of playerMaps) {
    const existing = heroStats.get(row.player_hero) ?? {
      maps: new Set(), elims: 0, deaths: 0, damage: 0, healing: 0, time: 0, fb: 0,
      allDamage: 0, barrierDamage: 0, healingReceived: 0, selfHealing: 0,
      damageTaken: 0, damageBlocked: 0, defAssists: 0, offAssists: 0,
      ultsEarned: 0, ultsUsed: 0, soloKills: 0, objKills: 0,
      envKills: 0, envDeaths: 0, critHits: 0, critAccuracy: 0,
      weaponAccuracy: 0, multikillBest: 0, multikills: 0, scopedAccuracy: 0,
    }
    existing.maps.add(row.mapDataId)
    existing.elims += row.eliminations
    existing.deaths += row.deaths
    existing.damage += row.hero_damage_dealt
    existing.healing += row.healing_dealt
    existing.time += row.hero_time_played
    existing.fb += row.final_blows
    existing.allDamage += row.all_damage_dealt
    existing.barrierDamage += row.barrier_damage_dealt
    existing.healingReceived += row.healing_received
    existing.selfHealing += row.self_healing
    existing.damageTaken += row.damage_taken
    existing.damageBlocked += row.damage_blocked
    existing.defAssists += row.defensive_assists
    existing.offAssists += row.offensive_assists
    existing.ultsEarned += row.ultimates_earned
    existing.ultsUsed += row.ultimates_used
    existing.soloKills += row.solo_kills
    existing.objKills += row.objective_kills
    existing.envKills += row.environmental_kills
    existing.envDeaths += row.environmental_deaths
    existing.critHits += row.critical_hits
    // For accuracy fields, we'll average across maps later
    existing.critAccuracy += row.critical_hit_accuracy
    existing.weaponAccuracy += row.weapon_accuracy
    existing.multikillBest = Math.max(existing.multikillBest, row.multikill_best)
    existing.multikills += row.multikills
    existing.scopedAccuracy += row.scoped_accuracy
    heroStats.set(row.player_hero, existing)
  }

  // Load hero portraits for avatar URLs
  const portraits = await loadHeroPortraits()

  const heroPool = [...heroStats.entries()]
    .map(([hero, s]) => {
      const mapCount = s.maps.size
      const t10 = s.time > 0 ? 600 / s.time : 0  // per-10-minute multiplier

      // Aggregate advanced stats for maps where this hero was played
      const heroMapIds = [...s.maps]
      const heroAdvanced = heroMapIds
        .map((mdId) => advancedStatsMap.get(mdId))
        .filter((a): a is NonNullable<typeof a> => a != null)
      const advCount = heroAdvanced.length

      return {
        hero,
        portrait: portraits.get(heroNameToSlug(hero)) ?? null,
        mapsPlayed: mapCount,
        totalTime: round(s.time),
        totalElims: s.elims,
        totalDeaths: s.deaths,
        totalDamage: round(s.damage),
        totalHealing: round(s.healing),
        totalFB: s.fb,
        // Extended stats
        allDamageDealt: round(s.allDamage),
        barrierDamageDealt: round(s.barrierDamage),
        healingReceived: round(s.healingReceived),
        selfHealing: round(s.selfHealing),
        damageTaken: round(s.damageTaken),
        damageBlocked: round(s.damageBlocked),
        defensiveAssists: s.defAssists,
        offensiveAssists: s.offAssists,
        ultimatesEarned: s.ultsEarned,
        ultimatesUsed: s.ultsUsed,
        soloKills: s.soloKills,
        objectiveKills: s.objKills,
        environmentalKills: s.envKills,
        environmentalDeaths: s.envDeaths,
        criticalHits: s.critHits,
        criticalHitAccuracy: mapCount > 0 ? round(s.critAccuracy / mapCount) : 0,
        weaponAccuracy: mapCount > 0 ? round(s.weaponAccuracy / mapCount) : 0,
        multikillBest: s.multikillBest,
        multikills: s.multikills,
        scopedAccuracy: mapCount > 0 ? round(s.scopedAccuracy / mapCount) : 0,
        // Per-10-min rates
        elimsPer10: round(s.elims * t10),
        deathsPer10: round(s.deaths * t10),
        fbPer10: round(s.fb * t10),
        damagePer10: round(s.damage * t10),
        healingPer10: round(s.healing * t10),
        ultsPer10: round(s.ultsUsed * t10),
        soloKillsPer10: round(s.soloKills * t10),
        // Advanced per-hero stats (averaged across maps played on this hero)
        avgFletaPct: advCount > 0 ? round(heroAdvanced.reduce((a, h) => a + (h.fletaDeadliftPercentage ?? 0), 0) / advCount) : 0,
        avgFirstPickPct: advCount > 0 ? round(heroAdvanced.reduce((a, h) => a + (h.firstPickPercentage ?? 0), 0) / advCount) : 0,
        avgFirstDeathPct: advCount > 0 ? round(heroAdvanced.reduce((a, h) => a + (h.firstDeathPercentage ?? 0), 0) / advCount) : 0,
        avgUltChargeTime: advCount > 0 ? round(heroAdvanced.reduce((a, h) => a + (h.averageUltChargeTime ?? 0), 0) / advCount) : 0,
        avgKillsPerUlt: advCount > 0 ? round(heroAdvanced.reduce((a, h) => a + (h.killsPerUltimate ?? 0), 0) / advCount) : 0,
        avgDroughtTime: advCount > 0 ? round(heroAdvanced.reduce((a, h) => a + (h.droughtTime ?? 0), 0) / advCount) : 0,
      }
    })
    .sort((a, b) => b.totalTime - a.totalTime)

  // Career totals
  const totalMaps = mapDataIds.length
  const totalElims = maps.reduce((a, m) => a + m.eliminations, 0)
  const totalDeaths = maps.reduce((a, m) => a + m.deaths, 0)
  const totalDamage = maps.reduce((a, m) => a + m.damage, 0)
  const totalHealing = maps.reduce((a, m) => a + m.healing, 0)
  const totalFB = maps.reduce((a, m) => a + m.finalBlows, 0)
  const avgFPPct = maps.length > 0 ? round(maps.reduce((a, m) => a + m.firstPickPct, 0) / maps.length) : 0
  const avgFDPct = maps.length > 0 ? round(maps.reduce((a, m) => a + m.firstDeathPct, 0) / maps.length) : 0

  // Get team from most recent map
  const recentTeamRow = await prisma.$queryRaw<[{ player_team: string }]>`
    SELECT player_team FROM scrim_player_stats
    WHERE player_name = ${playerName}
    ORDER BY "mapDataId" DESC, match_time DESC
    LIMIT 1
  `
  const team = recentTeamRow?.[0]?.player_team ?? 'Unknown'

  return NextResponse.json({
    player: {
      name: playerName,
      team,
      mostPlayedHero: heroPool[0]?.hero ?? 'Unknown',
      mapsPlayed: totalMaps,
    },
    career: {
      eliminations: totalElims,
      deaths: totalDeaths,
      damage: totalDamage,
      healing: totalHealing,
      finalBlows: totalFB,
      avgFirstPickPct: avgFPPct,
      avgFirstDeathPct: avgFDPct,
    },
    heroPool,
    maps,
  })
}
