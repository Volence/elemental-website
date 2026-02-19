import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { round } from '@/lib/scrim-parser/utils'
import { calculateStats } from '@/lib/scrim-parser/calculate-stats'
import { loadHeroPortraits, heroNameToSlug } from '@/lib/scrim-parser/heroIcons'
import { heroRoleMapping } from '@/lib/scrim-parser/heroes'
import { getUserScope, type UserScope } from '@/access/scrimScope'

// ────────────────────────────────────────────────────────────────────────
// GET /api/player-stats
//   → Returns list of all players with career totals (merged by personId)
//
// GET /api/player-stats?player=Lilly
//   → Returns detailed stats for a single player across all maps
//
// GET /api/player-stats?personId=42
//   → Returns detailed stats for a person, merging all their aliases
// ────────────────────────────────────────────────────────────────────────

interface PlayerListRow {
  display_name: string
  person_id: number | null
  player_team: string
  maps_played: number
  total_elims: number
  total_deaths: number
  total_damage: number
  total_healing: number
  total_fb: number
  most_played_hero: string
  aliases: string
}

interface PlayerMapRow {
  mapDataId: number
  player_name: string
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

interface MapInfoRow {
  mapDataId: number
  map_name: string
  map_type: string
  scrim_name: string
  scrim_date: Date
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const playerName = url.searchParams.get('player')
  const personIdStr = url.searchParams.get('personId')
  const range = url.searchParams.get('range') ?? 'last20'

  // Get user scope for data filtering
  const scope = await getUserScope()

  // Build scrim scope SQL clause for non-full-access users
  let scrimScopeClause = ''
  if (scope && !scope.isFullAccess && scope.assignedTeamIds.length > 0) {
    scrimScopeClause = `AND s."payloadTeamId" IN (${scope.assignedTeamIds.join(',')})`
  } else if (scope && !scope.isFullAccess) {
    // No assigned teams — return empty
    return NextResponse.json({ players: [] })
  }

  if (personIdStr) {
    const personId = parseInt(personIdStr)
    if (!isNaN(personId)) {
      return getPlayerDetailByPerson(personId, range, scrimScopeClause)
    }
  }

  if (playerName) {
    return getPlayerDetail(playerName, range, scrimScopeClause)
  }

  return getPlayerList(range, scrimScopeClause)
}

// ── Player List ─────────────────────────────────────────

async function getPlayerList(range: string, scrimScopeClause: string = '') {
  // Pre-compute eligible mapDataIds based on the range filter
  let mapFilter: number[] | null = null
  if (range === 'last20' || range === 'last50') {
    const limit = range === 'last20' ? 20 : 50
    const recentMaps = await prisma.$queryRawUnsafe<Array<{ id: number }>>(`
      SELECT md.id
      FROM scrim_map_data md
      JOIN scrim_maps sm ON md."mapId" = sm.id
      JOIN scrim_scrims s ON sm."scrimId" = s.id
      WHERE 1=1 ${scrimScopeClause}
      ORDER BY s.date DESC, md.id DESC
      LIMIT ${limit}
    `)
    mapFilter = recentMaps.map(r => r.id)
  } else if (range === 'last30d') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentMaps = await prisma.$queryRawUnsafe<Array<{ id: number }>>(`
      SELECT md.id
      FROM scrim_map_data md
      JOIN scrim_maps sm ON md."mapId" = sm.id
      JOIN scrim_scrims s ON sm."scrimId" = s.id
      WHERE s.date >= '${cutoff.toISOString()}' ${scrimScopeClause}
    `)
    mapFilter = recentMaps.map(r => r.id)
  } else if (scrimScopeClause) {
    // 'all' range but with scope — need to get maps for scoped scrims only
    const scopedMaps = await prisma.$queryRawUnsafe<Array<{ id: number }>>(`
      SELECT md.id
      FROM scrim_map_data md
      JOIN scrim_maps sm ON md."mapId" = sm.id
      JOIN scrim_scrims s ON sm."scrimId" = s.id
      WHERE 1=1 ${scrimScopeClause}
    `)
    mapFilter = scopedMaps.map(r => r.id)
  }
  // 'all' = no filter (mapFilter stays null)

  // Aggregate career stats per player, merging aliases by personId when available.
  // Uses raw player_team from logs (NOT payloadTeamId which is always the uploading team).
  // Build and run the player list query, with optional map filter
  const buildPlayerListQuery = (filterIds: number[] | null) => {
    const filterClause = filterIds
      ? `WHERE ps."mapDataId" = ANY(ARRAY[${filterIds.join(',')}]::int[])`
      : ''
    return prisma.$queryRawUnsafe<PlayerListRow[]>(`
      WITH final_stats AS (
        SELECT ps.*
        FROM scrim_player_stats ps
        INNER JOIN (
          SELECT "mapDataId", MAX(match_time) as max_time
          FROM scrim_player_stats
          GROUP BY "mapDataId"
        ) mx ON ps."mapDataId" = mx."mapDataId" AND ps.match_time = mx.max_time
        ${filterClause}
      ),
      deduped AS (
        SELECT DISTINCT ON (player_name, player_hero, "mapDataId")
          *
        FROM final_stats
        ORDER BY player_name, player_hero, "mapDataId", id DESC
      ),
      with_display AS (
        SELECT d.*,
          COALESCE(d."personId"::text, d.player_name) as merge_key,
          COALESCE(
            (SELECT p.name FROM people p WHERE p.id = d."personId"),
            d.player_name
          ) as display_name
        FROM deduped d
      ),
      hero_ranks AS (
        SELECT merge_key, player_hero,
          ROW_NUMBER() OVER (PARTITION BY merge_key ORDER BY SUM(hero_time_played) DESC) as rn
        FROM with_display
        GROUP BY merge_key, player_hero
      )
      SELECT
        wd.display_name,
        MAX(wd."personId")::int as person_id,
        (SELECT player_team FROM with_display WHERE merge_key = wd.merge_key ORDER BY "mapDataId" DESC LIMIT 1) as player_team,
        COUNT(DISTINCT wd."mapDataId")::int as maps_played,
        SUM(wd.eliminations)::int as total_elims,
        SUM(wd.deaths)::int as total_deaths,
        SUM(wd.hero_damage_dealt)::float as total_damage,
        SUM(wd.healing_dealt)::float as total_healing,
        SUM(wd.final_blows)::int as total_fb,
        hr.player_hero as most_played_hero,
        STRING_AGG(DISTINCT wd.player_name, ', ') as aliases
      FROM with_display wd
      JOIN hero_ranks hr ON hr.merge_key = wd.merge_key AND hr.rn = 1
      GROUP BY wd.merge_key, wd.display_name, hr.player_hero
      ORDER BY maps_played DESC, wd.display_name
    `)
  }

  const players = await buildPlayerListQuery(mapFilter)
  // Map raw log team names → Payload teams using scrim_scrims.payloadTeamId.
  // For each payloadTeamId, find all distinct raw team names from scrims and map
  // any raw name that contains the Payload team name (e.g. "Vicious Inferno" → "Inferno").
  const rawTeamToPayload = new Map<string, { teamId: number; teamName: string }>()
  try {
    const scrimTeams = await prisma.$queryRaw<Array<{ raw_team: string; team_id: number; team_name: string }>>`
      SELECT DISTINCT
        ps.player_team as raw_team,
        t.id as team_id,
        t.name as team_name
      FROM scrim_player_stats ps
      JOIN scrim_scrims s ON s.id = ps."scrimId"
      JOIN teams t ON s."payloadTeamId" = t.id
      WHERE s."payloadTeamId" IS NOT NULL
        AND ps.player_team IS NOT NULL
        AND ps.player_team != ''
    `
    for (const row of scrimTeams) {
      // Map raw team name if it contains the Payload team name (case-insensitive)
      if (row.raw_team.toLowerCase().includes(row.team_name.toLowerCase())) {
        rawTeamToPayload.set(row.raw_team, { teamId: row.team_id, teamName: row.team_name })
      }
    }
  } catch { /* skip if query fails */ }

  return NextResponse.json({
    players: players.map((p) => {
      const teamInfo = rawTeamToPayload.get(p.player_team)
      return {
        name: p.display_name,
        personId: p.person_id,
        team: teamInfo?.teamName ?? p.player_team,
        payloadTeamId: teamInfo?.teamId ?? null,
        payloadTeamName: teamInfo?.teamName ?? null,
        mapsPlayed: Number(p.maps_played),
        eliminations: Number(p.total_elims),
        deaths: Number(p.total_deaths),
        damage: round(Number(p.total_damage)),
        healing: round(Number(p.total_healing)),
        finalBlows: Number(p.total_fb),
        mostPlayedHero: p.most_played_hero,
        aliases: p.aliases ? p.aliases.split(', ') : [p.display_name],
      }
    }),
  })
}

// ── Player Detail (by personId — merges all aliases) ────

async function getPlayerDetailByPerson(personId: number, range: string, scrimScopeClause: string = '') {
  // Look up Person display name
  const personRow = await prisma.$queryRaw<[{ name: string }]>`
    SELECT name FROM people WHERE id = ${personId} LIMIT 1
  `
  const personName = personRow?.[0]?.name

  if (!personName) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  // Find all raw player_name aliases for this person
  const aliasRows = await prisma.$queryRaw<Array<{ player_name: string }>>`
    SELECT DISTINCT player_name FROM scrim_player_stats WHERE "personId" = ${personId}
  `
  const aliases = aliasRows.map(r => r.player_name)

  if (aliases.length === 0) {
    return NextResponse.json({ error: 'No stats found for this person' }, { status: 404 })
  }

  // Get all maps for all aliases (final round stats)
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
      player_name,
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
    WHERE "personId" = ${personId}
    ORDER BY player_name, player_hero, "mapDataId", id DESC
  `

  if (playerMaps.length === 0) {
    return NextResponse.json({ error: 'No map stats found' }, { status: 404 })
  }

  return buildPlayerDetailResponse(personName, playerMaps, aliases, range, personId)
}

// ── Player Detail (by raw name — no merge) ──────────────

async function getPlayerDetail(playerName: string, range: string, scrimScopeClause: string = '') {
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
      player_name,
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

  return buildPlayerDetailResponse(playerName, playerMaps, [playerName], range)
}

// ── Shared detail response builder ──────────────────────

async function buildPlayerDetailResponse(
  displayName: string,
  playerMaps: PlayerMapRow[],
  aliases: string[],
  range: string,
  personId?: number,
) {
  // Get map info (map name, type, scrim name, date) for each map
  const allMapDataIds = [...new Set(playerMaps.map((m) => m.mapDataId))]

  const mapInfoResults = await Promise.all(
    allMapDataIds.map(async (mdId) => {
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

  // ── Apply range filter ──
  // Sort mapDataIds by scrim date descending and filter
  const sortedMapIds = [...mapInfoMap.entries()]
    .sort((a, b) => new Date(b[1].scrimDate).getTime() - new Date(a[1].scrimDate).getTime())
    .map(([id]) => id)

  let filteredMapIds: Set<number>
  if (range === 'last20') {
    filteredMapIds = new Set(sortedMapIds.slice(0, 20))
  } else if (range === 'last50') {
    filteredMapIds = new Set(sortedMapIds.slice(0, 50))
  } else if (range === 'last30d') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    filteredMapIds = new Set(sortedMapIds.filter(id => {
      const info = mapInfoMap.get(id)
      return info && new Date(info.scrimDate) >= cutoff
    }))
  } else {
    filteredMapIds = new Set(sortedMapIds)
  }

  // Filter playerMaps to only include maps in the range
  playerMaps = playerMaps.filter(m => filteredMapIds.has(m.mapDataId))
  const mapDataIds = [...filteredMapIds]

  // Calculate advanced stats for each map — use any alias that matches
  const advancedStats = await Promise.all(
    mapDataIds.map(async (mdId) => {
      // Find which alias was used on this map
      const aliasOnMap = playerMaps.find(m => m.mapDataId === mdId)?.player_name ?? aliases[0]
      try {
        const stats = await calculateStats(mdId, aliasOnMap)
        return { mapDataId: mdId, stats }
      } catch {
        return { mapDataId: mdId, stats: null }
      }
    })
  )
  const advancedStatsMap = new Map(advancedStats.map((a) => [a.mapDataId, a.stats]))

  // Build per-map, per-hero rows
  const maps = playerMaps.map((row) => {
    const info = mapInfoMap.get(row.mapDataId)
    const advanced = advancedStatsMap.get(row.mapDataId)

    return {
      mapDataId: row.mapDataId,
      mapName: info?.mapName ?? 'Unknown',
      mapType: info?.mapType ?? 'Unknown',
      scrimName: info?.scrimName ?? 'Unknown',
      scrimDate: info?.scrimDate ?? new Date(),
      hero: row.player_hero,
      eliminations: row.eliminations,
      finalBlows: row.final_blows,
      deaths: row.deaths,
      damage: round(row.hero_damage_dealt),
      healing: round(row.healing_dealt),
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
        avgUltHoldTime: advCount > 0 ? round(heroAdvanced.reduce((a, h) => a + (h.averageTimeToUseUlt ?? 0), 0) / advCount) : 0,
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

  // Get team from most recent map — resolve raw player_team to Payload team name
  // via scrim → payloadTeamId → teams
  const recentTeamRow = await prisma.$queryRaw<[{ team_name: string; payload_team: string | null; payload_team_id: number | null }]>`
    SELECT ps.player_team as team_name, t.name as payload_team, t.id as payload_team_id
    FROM scrim_player_stats ps
    JOIN scrim_map_data md ON md.id = ps."mapDataId"
    JOIN scrim_scrims s ON s.id = md."scrimId"
    LEFT JOIN teams t ON s."payloadTeamId" = t.id
    WHERE ps.player_name = ANY(${aliases}::text[])
    ORDER BY ps."mapDataId" DESC, ps.match_time DESC
    LIMIT 1
  `
  const rawTeam = recentTeamRow?.[0]?.team_name ?? 'Unknown'
  const payloadTeam = recentTeamRow?.[0]?.payload_team
  const payloadTeamId = recentTeamRow?.[0]?.payload_team_id ?? null
  // Use Payload team name if the raw name contains it (handles renames like "Vicious Inferno" → "Inferno")
  const team = payloadTeam && rawTeam.toLowerCase().includes(payloadTeam.toLowerCase())
    ? payloadTeam
    : (payloadTeam ?? rawTeam)

  // ── Trend data: per-scrim averages over time ──
  // Group maps by scrimId, compute per-10 rates per scrim
  type ScrimGroup = { scrimId: number; scrimName: string; scrimDate: Date; maps: PlayerMapRow[] }
  const scrimGroups = new Map<number, ScrimGroup>()

  // Batch lookup: mapDataId → scrimId
  const mapToScrim = await prisma.$queryRaw<Array<{ mapDataId: number; scrimId: number }>>`
    SELECT md.id as "mapDataId", sm."scrimId"
    FROM scrim_map_data md
    JOIN scrim_maps sm ON md."mapId" = sm.id
    WHERE md.id = ANY(${mapDataIds}::int[])
  `
  const mapToScrimMap = new Map(mapToScrim.map(r => [r.mapDataId, r.scrimId]))

  for (const row of playerMaps) {
    const info = mapInfoMap.get(row.mapDataId)
    if (!info) continue
    const sid = mapToScrimMap.get(row.mapDataId)
    if (!sid) continue
    if (!scrimGroups.has(sid)) {
      scrimGroups.set(sid, { scrimId: sid, scrimName: info.scrimName, scrimDate: info.scrimDate, maps: [] })
    }
    scrimGroups.get(sid)!.maps.push(row)
  }

  const trendData = [...scrimGroups.values()]
    .sort((a, b) => new Date(a.scrimDate).getTime() - new Date(b.scrimDate).getTime())
    .map(sg => {
      const totalTime = sg.maps.reduce((a, m) => a + m.hero_time_played, 0)
      const t10 = totalTime > 0 ? 600 / totalTime : 0
      return {
        scrimDate: sg.scrimDate,
        scrimName: sg.scrimName,
        mapCount: sg.maps.length,
        elimsPer10: round(sg.maps.reduce((a, m) => a + m.eliminations, 0) * t10),
        fbPer10: round(sg.maps.reduce((a, m) => a + m.final_blows, 0) * t10),
        deathsPer10: round(sg.maps.reduce((a, m) => a + m.deaths, 0) * t10),
        damagePer10: round(sg.maps.reduce((a, m) => a + m.hero_damage_dealt, 0) * t10),
        healingPer10: round(sg.maps.reduce((a, m) => a + m.healing_dealt, 0) * t10),
        damageTakenPer10: round(sg.maps.reduce((a, m) => a + m.damage_taken, 0) * t10),
        damageBlockedPer10: round(sg.maps.reduce((a, m) => a + m.damage_blocked, 0) * t10),
        ultsEarnedPer10: round(sg.maps.reduce((a, m) => a + m.ultimates_earned, 0) * t10),
        soloKillsPer10: round(sg.maps.reduce((a, m) => a + m.solo_kills, 0) * t10),
        envKillsPer10: round(sg.maps.reduce((a, m) => a + m.environmental_kills, 0) * t10),
      }
    })

  // ── Hero matchups: killed most / died to most ──
  const [killedMost, diedToMost] = await Promise.all([
    prisma.$queryRaw<Array<{ hero: string; count: bigint }>>`
      SELECT victim_hero as hero, COUNT(*) as count
      FROM scrim_kills
      WHERE attacker_name = ANY(${aliases}::text[])
        AND "mapDataId" = ANY(${mapDataIds}::int[])
        AND event_ability != 'Resurrect'
      GROUP BY victim_hero
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ hero: string; count: bigint }>>`
      SELECT attacker_hero as hero, COUNT(*) as count
      FROM scrim_kills
      WHERE victim_name = ANY(${aliases}::text[])
        AND "mapDataId" = ANY(${mapDataIds}::int[])
        AND event_ability != 'Resurrect'
      GROUP BY attacker_hero
      ORDER BY count DESC
      LIMIT 10
    `,
  ])

  const heroMatchups = {
    killedMost: killedMost.map(r => ({ hero: r.hero, count: Number(r.count) })),
    diedToMost: diedToMost.map(r => ({ hero: r.hero, count: Number(r.count) })),
  }

  // ── Map winrates ──
  // For each mapDataId, determine win/loss from match_end scores
  const mapResults = await prisma.$queryRaw<Array<{
    mapDataId: number; map_name: string; map_type: string;
    team_1_score: number | null; team_2_score: number | null;
    player_team: string; team_1_name: string; team_2_name: string;
  }>>`
    SELECT
      md.id as "mapDataId",
      ms.map_name, ms.map_type,
      me.team_1_score, me.team_2_score,
      ps.player_team, ms.team_1_name, ms.team_2_name
    FROM scrim_map_data md
    JOIN scrim_match_starts ms ON ms."mapDataId" = md.id
    LEFT JOIN LATERAL (
      SELECT team_1_score, team_2_score
      FROM scrim_match_ends
      WHERE "mapDataId" = md.id
      ORDER BY round_number DESC
      LIMIT 1
    ) me ON true
    JOIN scrim_player_stats ps ON ps."mapDataId" = md.id AND ps.player_name = ANY(${aliases}::text[])
    WHERE md.id = ANY(${mapDataIds}::int[])
    GROUP BY md.id, ms.map_name, ms.map_type, me.team_1_score, me.team_2_score, ps.player_team, ms.team_1_name, ms.team_2_name
  `

  // Determine win/loss per map
  const mapWinMap = new Map<string, { wins: number; losses: number; draws: number }>()
  const mapTypeWinMap = new Map<string, { wins: number; losses: number; draws: number }>()

  for (const mr of mapResults) {
    if (mr.team_1_score == null || mr.team_2_score == null) continue

    const isTeam1 = mr.player_team === mr.team_1_name
    const myScore = isTeam1 ? mr.team_1_score : mr.team_2_score
    const theirScore = isTeam1 ? mr.team_2_score : mr.team_1_score

    const result = myScore > theirScore ? 'win' : myScore < theirScore ? 'loss' : 'draw'

    for (const [map, key] of [[mr.map_name, mr.map_name], [mr.map_type, mr.map_type]]) {
      const target = key === mr.map_name ? mapWinMap : mapTypeWinMap
      if (!target.has(map)) target.set(map, { wins: 0, losses: 0, draws: 0 })
      const entry = target.get(map)!
      if (result === 'win') entry.wins++
      else if (result === 'loss') entry.losses++
      else entry.draws++
    }
  }

  const mapWinrates = [...mapWinMap.entries()]
    .map(([map, r]) => ({
      map,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      total: r.wins + r.losses + r.draws,
      winrate: (r.wins + r.losses + r.draws) > 0 ? round((r.wins / (r.wins + r.losses + r.draws)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const mapTypeWinrates = [...mapTypeWinMap.entries()]
    .map(([mapType, r]) => ({
      mapType,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      total: r.wins + r.losses + r.draws,
      winrate: (r.wins + r.losses + r.draws) > 0 ? round((r.wins / (r.wins + r.losses + r.draws)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // ── Role time split ──
  const roleMap = heroRoleMapping as Record<string, string>
  const roleTimeSplit: Record<string, number> = { Tank: 0, Damage: 0, Support: 0 }
  for (const row of playerMaps) {
    const role = roleMap[row.player_hero] ?? 'Damage'
    roleTimeSplit[role] = (roleTimeSplit[role] ?? 0) + row.hero_time_played
  }
  // Round values
  for (const key of Object.keys(roleTimeSplit)) {
    roleTimeSplit[key] = round(roleTimeSplit[key])
  }

  // ── Final blows by method ──
  const fbByMethod = await prisma.$queryRaw<Array<{ method: string; count: bigint }>>`
    SELECT event_ability as method, COUNT(*) as count
    FROM scrim_kills
    WHERE attacker_name = ANY(${aliases}::text[])
      AND "mapDataId" = ANY(${mapDataIds}::int[])
      AND event_ability != 'Resurrect'
      AND event_ability != '0'
      AND event_ability != ''
    GROUP BY event_ability
    ORDER BY count DESC
  `

  const finalBlowsByMethod = fbByMethod.map(r => ({
    method: r.method,
    count: Number(r.count),
  }))

  return NextResponse.json({
    player: {
      name: displayName,
      personId: personId ?? null,
      aliases,
      team,
      payloadTeamId,
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
    trendData,
    heroMatchups,
    mapWinrates,
    mapTypeWinrates,
    roleTimeSplit,
    finalBlowsByMethod,
  })
}
