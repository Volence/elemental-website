import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { round } from '@/lib/scrim-parser/utils'
import { loadHeroPortraits, heroNameToSlug } from '@/lib/scrim-parser/heroIcons'
import { heroRoleMapping } from '@/lib/scrim-parser/heroes'
import { getUserScope } from '@/access/scrimScope'

// ────────────────────────────────────────────────────────────────────────
// GET /api/scrim-hero-stats
//   → Hero list with aggregate stats
//   ?team=TeamName  — filter by team
//   ?range=all|last7d|last30d|last10|last20  — time/scrim range
//
// GET /api/scrim-hero-stats?hero=Ana
//   → Detailed stats for a single hero
// ────────────────────────────────────────────────────────────────────────

type HeroListRow = {
  player_hero: string
  total_maps: bigint
  total_elims: bigint
  total_deaths: bigint
  total_damage: number
  total_healing: number
  total_fb: bigint
  total_time: number
}

type HeroStatRow = {
  mapDataId: number
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
  barrier_damage_dealt: number
  healing_received: number
  self_healing: number
  damage_taken: number
  damage_blocked: number
  defensive_assists: number
  offensive_assists: number
  ultimates_earned: number
  ultimates_used: number
  solo_kills: number
  objective_kills: number
  environmental_kills: number
  environmental_deaths: number
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
  scrimId: number
}

// ── Team Name Normalization ──
// Maps raw scrim team names (e.g. "Vicious Inferno") to Payload team names (e.g. "Inferno")
// using scrim_scrims.payloadTeamId → teams.name

type TeamInfo = {
  rawName: string
  displayName: string
  payloadTeamId: number | null
  isOurTeam: boolean
}

async function buildTeamMapping(): Promise<{
  teams: TeamInfo[]
  rawToDisplay: Map<string, string>
  ourTeamRaws: Set<string>
}> {
  // 1. Get all distinct raw team names
  const rawTeamRows = await prisma.$queryRaw<Array<{ player_team: string }>>`
    SELECT DISTINCT player_team FROM scrim_player_stats
    WHERE hero_time_played > 0 AND player_team IS NOT NULL AND player_team != ''
    ORDER BY player_team
  `

  // 2. Map raw team names → Payload team names using scrim_scrims.payloadTeamId
  const rawToPayload = new Map<string, { teamId: number; teamName: string }>()
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
        rawToPayload.set(row.raw_team, { teamId: row.team_id, teamName: row.team_name })
      }
    }
  } catch { /* skip if query fails */ }

  // 3. Build categorized team list
  const rawToDisplay = new Map<string, string>()
  const ourTeamRaws = new Set<string>()
  const teams: TeamInfo[] = rawTeamRows.map(r => {
    const payloadInfo = rawToPayload.get(r.player_team)
    const displayName = payloadInfo?.teamName ?? r.player_team
    const isOurTeam = !!payloadInfo
    rawToDisplay.set(r.player_team, displayName)
    if (isOurTeam) ourTeamRaws.add(r.player_team)
    return {
      rawName: r.player_team,
      displayName,
      payloadTeamId: payloadInfo?.teamId ?? null,
      isOurTeam,
    }
  })

  return { teams, rawToDisplay, ourTeamRaws }
}

/** Get scrim IDs that belong to the given Payload team IDs */
async function getScrimIdsForTeams(teamIds: number[]): Promise<number[]> {
  if (teamIds.length === 0) return []
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM scrim_scrims WHERE "payloadTeamId" IN (${teamIds.join(',')})`
  )
  return rows.map(r => r.id)
}

export async function GET(req: NextRequest) {
  try {
    const hero = req.nextUrl.searchParams.get('hero')
    const range = req.nextUrl.searchParams.get('range') ?? 'all'
    const team = req.nextUrl.searchParams.get('team') ?? 'all'

    // Get user scope for data filtering
    const scope = await getUserScope()

    // Build scrim scope clause for non-full-access users
    // This restricts data to only scrims linked to their assigned teams
    let scrimScopeClause = ''
    if (scope && !scope.isFullAccess && scope.assignedTeamIds.length > 0) {
      scrimScopeClause = `AND ps."scrimId" IN (SELECT id FROM scrim_scrims WHERE "payloadTeamId" IN (${scope.assignedTeamIds.join(',')}))`
    } else if (scope && !scope.isFullAccess) {
      // No assigned teams — return empty
      return NextResponse.json({ heroes: [], teams: [] })
    }

    if (!hero) {
      return getHeroList(range, team, scrimScopeClause, scope)
    }

    return getHeroDetail(hero, range, team, scrimScopeClause, scope)
  } catch (err) {
    console.error('[scrim-hero-stats] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Hero List ────────────────────────────────────────────

async function getHeroList(range: string, team: string, scrimScopeClause: string, scope: Awaited<ReturnType<typeof getUserScope>>) {
  const { teams: allTeams } = await buildTeamMapping()

  // For scoped users, filter team list to only their own teams
  const teams = (scope && !scope.isFullAccess)
    ? allTeams.filter(t => t.isOurTeam && t.payloadTeamId !== null && scope.assignedTeamIds.includes(t.payloadTeamId))
    : allTeams

  // Build SQL filters
  const filters: string[] = ['ps.hero_time_played > 0']

  // Team filter: resolve display name back to raw name(s)
  if (team && team !== 'all') {
    const matchingRaws = teams
      .filter(t => t.displayName === team || t.rawName === team)
      .map(t => `'${t.rawName.replace(/'/g, "''")}'`)
    if (matchingRaws.length > 0) {
      filters.push(`ps.player_team IN (${matchingRaws.join(', ')})`)
    }
  }

  // Range filter
  if (range === 'last7d') {
    filters.push(`md."createdAt" >= NOW() - INTERVAL '7 days'`)
  } else if (range === 'last30d') {
    filters.push(`md."createdAt" >= NOW() - INTERVAL '30 days'`)
  }
  // For last10/last20 scrims, we'll need a subquery
  let scrimLimitClause = ''
  if (range === 'last10' || range === 'last20') {
    const limit = range === 'last10' ? 10 : 20
    scrimLimitClause = `AND ps."scrimId" IN (SELECT id FROM scrim_scrims ORDER BY date DESC LIMIT ${limit})`
  }

  const whereClause = filters.join(' AND ')

  const rows = await prisma.$queryRawUnsafe<HeroListRow[]>(`
    SELECT
      ps.player_hero,
      COUNT(DISTINCT ps."mapDataId") as total_maps,
      SUM(ps.eliminations) as total_elims,
      SUM(ps.deaths) as total_deaths,
      SUM(ps.hero_damage_dealt) as total_damage,
      SUM(ps.healing_dealt) as total_healing,
      SUM(ps.final_blows) as total_fb,
      SUM(ps.hero_time_played) as total_time
    FROM scrim_player_stats ps
    JOIN scrim_map_data md ON md.id = ps."mapDataId"
    WHERE ${whereClause}
    ${scrimLimitClause}
    ${scrimScopeClause}
    GROUP BY ps.player_hero
    ORDER BY total_maps DESC, total_time DESC
  `)

  const portraits = await loadHeroPortraits()
  const roleMap = heroRoleMapping as Record<string, string>

  const heroes = rows.map((r) => ({
    hero: r.player_hero,
    portrait: portraits.get(heroNameToSlug(r.player_hero)) ?? null,
    role: roleMap[r.player_hero] ?? 'Damage',
    mapsPlayed: Number(r.total_maps),
    totalElims: Number(r.total_elims),
    totalDeaths: Number(r.total_deaths),
    totalDamage: round(r.total_damage),
    totalHealing: round(r.total_healing),
    totalFB: Number(r.total_fb),
    totalTime: round(r.total_time),
  }))

  return NextResponse.json({ heroes, teams })
}

// ── Hero Detail ──────────────────────────────────────────

async function getHeroDetail(hero: string, range: string, team: string, scrimScopeClause: string, scope: Awaited<ReturnType<typeof getUserScope>>) {
  // Resolve team filter
  let teamWhere: Record<string, unknown> = {}
  if (team && team !== 'all') {
    const { teams } = await buildTeamMapping()
    const matchingRaws = teams
      .filter(t => t.displayName === team || t.rawName === team)
      .map(t => t.rawName)
    if (matchingRaws.length === 1) {
      teamWhere = { player_team: matchingRaws[0] }
    } else if (matchingRaws.length > 1) {
      teamWhere = { player_team: { in: matchingRaws } }
    }
  }

  // Add scrim scope for non-full-access users
  const scrimIdFilter = (scope && !scope.isFullAccess && scope.assignedTeamIds.length > 0)
    ? { scrimId: { in: await getScrimIdsForTeams(scope.assignedTeamIds) } }
    : {}

  const heroStats = await prisma.scrimPlayerStat.findMany({
    where: { player_hero: hero, hero_time_played: { gt: 0 }, ...teamWhere, ...scrimIdFilter },
    orderBy: { mapDataId: 'asc' },
  }) as unknown as HeroStatRow[]

  if (heroStats.length === 0) {
    return NextResponse.json({ error: 'Hero not found or no data for selected filters' }, { status: 404 })
  }

  // Get map info for each map
  const allMapDataIds = [...new Set(heroStats.map((s) => s.mapDataId))]

  const mapInfoResults = await prisma.$queryRaw<MapInfoRow[]>`
    SELECT
      md.id as "mapDataId",
      ms.map_name, ms.map_type,
      s.name as scrim_name,
      s.date as scrim_date,
      s.id as "scrimId"
    FROM scrim_map_data md
    JOIN scrim_maps sm ON md."mapId" = sm.id
    JOIN scrim_scrims s ON sm."scrimId" = s.id
    JOIN scrim_match_starts ms ON ms."mapDataId" = md.id
    WHERE md.id = ANY(${allMapDataIds}::int[])
    GROUP BY md.id, ms.map_name, ms.map_type, s.name, s.date, s.id
  `

  const mapInfoMap = new Map(
    mapInfoResults.map((info) => [
      info.mapDataId,
      {
        mapName: info.map_name,
        mapType: info.map_type,
        scrimName: info.scrim_name,
        scrimDate: info.scrim_date,
        scrimId: info.scrimId,
      },
    ])
  )

  // Apply range filter
  const sortedMapIds = [...mapInfoMap.entries()]
    .sort((a, b) => new Date(b[1].scrimDate).getTime() - new Date(a[1].scrimDate).getTime())
    .map(([id]) => id)

  let filteredMapIds: Set<number>
  if (range === 'last10') {
    // Get last 10 distinct scrims
    const scrimIds = [...new Set(sortedMapIds.map(id => mapInfoMap.get(id)!.scrimId))]
    const recentScrimIds = new Set(scrimIds.slice(0, 10))
    filteredMapIds = new Set(sortedMapIds.filter(id => recentScrimIds.has(mapInfoMap.get(id)!.scrimId)))
  } else if (range === 'last20') {
    const scrimIds = [...new Set(sortedMapIds.map(id => mapInfoMap.get(id)!.scrimId))]
    const recentScrimIds = new Set(scrimIds.slice(0, 20))
    filteredMapIds = new Set(sortedMapIds.filter(id => recentScrimIds.has(mapInfoMap.get(id)!.scrimId)))
  } else if (range === 'last7d') {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    filteredMapIds = new Set(sortedMapIds.filter(id => {
      const info = mapInfoMap.get(id)
      return info && new Date(info.scrimDate) >= cutoff
    }))
  } else if (range === 'last30d') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    filteredMapIds = new Set(sortedMapIds.filter(id => {
      const info = mapInfoMap.get(id)
      return info && new Date(info.scrimDate) >= cutoff
    }))
  } else {
    filteredMapIds = new Set(sortedMapIds)
  }

  const filteredStats = heroStats.filter(s => filteredMapIds.has(s.mapDataId))
  const mapDataIds = [...filteredMapIds]

  if (filteredStats.length === 0) {
    return NextResponse.json({ error: 'No data for selected range' }, { status: 404 })
  }

  // ── Career totals ──
  const totalTime = filteredStats.reduce((a, s) => a + s.hero_time_played, 0)
  const t10 = totalTime > 0 ? 600 / totalTime : 0
  const totalElims = filteredStats.reduce((a, s) => a + s.eliminations, 0)
  const totalDeaths = filteredStats.reduce((a, s) => a + s.deaths, 0)
  const totalDamage = filteredStats.reduce((a, s) => a + s.hero_damage_dealt, 0)
  const totalHealing = filteredStats.reduce((a, s) => a + s.healing_dealt, 0)
  const totalFB = filteredStats.reduce((a, s) => a + s.final_blows, 0)

  // ── Top players on this hero ──
  const playerAgg = new Map<string, { maps: Set<number>; elims: number; deaths: number; damage: number; healing: number; time: number; fb: number }>()
  for (const s of filteredStats) {
    const existing = playerAgg.get(s.player_name) ?? { maps: new Set(), elims: 0, deaths: 0, damage: 0, healing: 0, time: 0, fb: 0 }
    existing.maps.add(s.mapDataId)
    existing.elims += s.eliminations
    existing.deaths += s.deaths
    existing.damage += s.hero_damage_dealt
    existing.healing += s.healing_dealt
    existing.time += s.hero_time_played
    existing.fb += s.final_blows
    playerAgg.set(s.player_name, existing)
  }

  const topPlayers = [...playerAgg.entries()]
    .map(([name, s]) => {
      const pt10 = s.time > 0 ? 600 / s.time : 0
      return {
        name,
        mapsPlayed: s.maps.size,
        totalTime: round(s.time),
        elimsPer10: round(s.elims * pt10),
        deathsPer10: round(s.deaths * pt10),
        damagePer10: round(s.damage * pt10),
        healingPer10: round(s.healing * pt10),
        fbPer10: round(s.fb * pt10),
      }
    })
    .sort((a, b) => b.mapsPlayed - a.mapsPlayed)

  // ── Best performance (highest FB game) ──
  let bestGame = null
  if (filteredStats.length > 0) {
    const best = filteredStats.reduce((a, b) => a.final_blows > b.final_blows ? a : b)
    const info = mapInfoMap.get(best.mapDataId)
    bestGame = {
      player: best.player_name,
      mapDataId: best.mapDataId,
      mapName: info?.mapName ?? 'Unknown',
      scrimName: info?.scrimName ?? 'Unknown',
      scrimDate: info?.scrimDate ?? new Date(),
      finalBlows: best.final_blows,
      eliminations: best.eliminations,
      deaths: best.deaths,
      damage: round(best.hero_damage_dealt),
      healing: round(best.healing_dealt),
    }
  }

  // ── Trend data: per-scrim averages ──
  const scrimGroups = new Map<number, { scrimId: number; scrimName: string; scrimDate: Date; stats: HeroStatRow[] }>()
  for (const s of filteredStats) {
    const info = mapInfoMap.get(s.mapDataId)
    if (!info) continue
    if (!scrimGroups.has(info.scrimId)) {
      scrimGroups.set(info.scrimId, { scrimId: info.scrimId, scrimName: info.scrimName, scrimDate: info.scrimDate, stats: [] })
    }
    scrimGroups.get(info.scrimId)!.stats.push(s)
  }

  const trendData = [...scrimGroups.values()]
    .sort((a, b) => new Date(a.scrimDate).getTime() - new Date(b.scrimDate).getTime())
    .map(sg => {
      const time = sg.stats.reduce((a, s) => a + s.hero_time_played, 0)
      const st10 = time > 0 ? 600 / time : 0
      return {
        scrimDate: sg.scrimDate,
        scrimName: sg.scrimName,
        mapCount: sg.stats.length,
        elimsPer10: round(sg.stats.reduce((a, s) => a + s.eliminations, 0) * st10),
        fbPer10: round(sg.stats.reduce((a, s) => a + s.final_blows, 0) * st10),
        deathsPer10: round(sg.stats.reduce((a, s) => a + s.deaths, 0) * st10),
        damagePer10: round(sg.stats.reduce((a, s) => a + s.hero_damage_dealt, 0) * st10),
        healingPer10: round(sg.stats.reduce((a, s) => a + s.healing_dealt, 0) * st10),
      }
    })

  // ── Hero matchups ──
  const [killedMost, diedToMost] = await Promise.all([
    prisma.$queryRaw<Array<{ hero: string; count: bigint }>>`
      SELECT victim_hero as hero, COUNT(*) as count
      FROM scrim_kills
      WHERE attacker_hero = ${hero}
        AND "mapDataId" = ANY(${mapDataIds}::int[])
        AND event_ability != 'Resurrect'
      GROUP BY victim_hero
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.$queryRaw<Array<{ hero: string; count: bigint }>>`
      SELECT attacker_hero as hero, COUNT(*) as count
      FROM scrim_kills
      WHERE victim_hero = ${hero}
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

  // ── Final blows by method ──
  const fbByMethod = await prisma.$queryRaw<Array<{ method: string; count: bigint }>>`
    SELECT event_ability as method, COUNT(*) as count
    FROM scrim_kills
    WHERE attacker_hero = ${hero}
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

  // Portrait
  const portraits = await loadHeroPortraits()
  const roleMap = heroRoleMapping as Record<string, string>

  return NextResponse.json({
    hero: {
      name: hero,
      portrait: portraits.get(heroNameToSlug(hero)) ?? null,
      role: roleMap[hero] ?? 'Damage',
      mapsPlayed: mapDataIds.length,
      totalTime: round(totalTime),
    },
    career: {
      eliminations: totalElims,
      deaths: totalDeaths,
      damage: round(totalDamage),
      healing: round(totalHealing),
      finalBlows: totalFB,
      elimsPer10: round(totalElims * t10),
      deathsPer10: round(totalDeaths * t10),
      damagePer10: round(totalDamage * t10),
      healingPer10: round(totalHealing * t10),
      fbPer10: round(totalFB * t10),
    },
    topPlayers,
    bestGame,
    trendData,
    heroMatchups,
    finalBlowsByMethod,
  })
}
