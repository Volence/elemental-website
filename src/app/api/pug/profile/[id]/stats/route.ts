import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

type AggRow = {
  total_games: bigint
  total_eliminations: bigint
  total_final_blows: bigint
  total_deaths: bigint
  total_damage: number
  total_hero_damage: number
  total_healing: number
  total_blocked: number
  total_ults_earned: bigint
  total_ults_used: bigint
}

type HeroRow = {
  player_hero: string
  time_played: number
  games: bigint
  eliminations: bigint
  deaths: bigint
  damage: number
  healing: number
}

const AGG_ALL = `
  SELECT
    COUNT(DISTINCT s.id) as total_games,
    COALESCE(SUM(sps.eliminations), 0) as total_eliminations,
    COALESCE(SUM(sps.final_blows), 0) as total_final_blows,
    COALESCE(SUM(sps.deaths), 0) as total_deaths,
    COALESCE(SUM(sps.all_damage_dealt), 0) as total_damage,
    COALESCE(SUM(sps.hero_damage_dealt), 0) as total_hero_damage,
    COALESCE(SUM(sps.healing_dealt), 0) as total_healing,
    COALESCE(SUM(sps.damage_blocked), 0) as total_blocked,
    COALESCE(SUM(sps.ultimates_earned), 0) as total_ults_earned,
    COALESCE(SUM(sps.ultimates_used), 0) as total_ults_used
  FROM scrim_player_stats sps
  JOIN scrim_scrims s ON s.id = sps."scrimId"
  WHERE sps."personId" = $1
    AND s."pugLobbyId" IS NOT NULL`

const AGG_SEASON = `
  SELECT
    COUNT(DISTINCT s.id) as total_games,
    COALESCE(SUM(sps.eliminations), 0) as total_eliminations,
    COALESCE(SUM(sps.final_blows), 0) as total_final_blows,
    COALESCE(SUM(sps.deaths), 0) as total_deaths,
    COALESCE(SUM(sps.all_damage_dealt), 0) as total_damage,
    COALESCE(SUM(sps.hero_damage_dealt), 0) as total_hero_damage,
    COALESCE(SUM(sps.healing_dealt), 0) as total_healing,
    COALESCE(SUM(sps.damage_blocked), 0) as total_blocked,
    COALESCE(SUM(sps.ultimates_earned), 0) as total_ults_earned,
    COALESCE(SUM(sps.ultimates_used), 0) as total_ults_used
  FROM scrim_player_stats sps
  JOIN scrim_scrims s ON s.id = sps."scrimId"
  JOIN pug_lobbies pl ON pl.id = s."pugLobbyId"
  WHERE sps."personId" = $1
    AND pl."payloadSeasonId" = $2`

const HERO_ALL = `
  SELECT
    sps.player_hero,
    COALESCE(SUM(sps.hero_time_played), 0) as time_played,
    COUNT(DISTINCT s.id) as games,
    COALESCE(SUM(sps.eliminations), 0) as eliminations,
    COALESCE(SUM(sps.deaths), 0) as deaths,
    COALESCE(SUM(sps.hero_damage_dealt), 0) as damage,
    COALESCE(SUM(sps.healing_dealt), 0) as healing
  FROM scrim_player_stats sps
  JOIN scrim_scrims s ON s.id = sps."scrimId"
  WHERE sps."personId" = $1
    AND s."pugLobbyId" IS NOT NULL
  GROUP BY sps.player_hero
  ORDER BY time_played DESC`

const HERO_SEASON = `
  SELECT
    sps.player_hero,
    COALESCE(SUM(sps.hero_time_played), 0) as time_played,
    COUNT(DISTINCT s.id) as games,
    COALESCE(SUM(sps.eliminations), 0) as eliminations,
    COALESCE(SUM(sps.deaths), 0) as deaths,
    COALESCE(SUM(sps.hero_damage_dealt), 0) as damage,
    COALESCE(SUM(sps.healing_dealt), 0) as healing
  FROM scrim_player_stats sps
  JOIN scrim_scrims s ON s.id = sps."scrimId"
  JOIN pug_lobbies pl ON pl.id = s."pugLobbyId"
  WHERE sps."personId" = $1
    AND pl."payloadSeasonId" = $2
  GROUP BY sps.player_hero
  ORDER BY time_played DESC`

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const personId = parseInt(id, 10)
  if (isNaN(personId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const seasonParam = request.nextUrl.searchParams.get('seasonId')
  const seasonId = seasonParam ? parseInt(seasonParam, 10) : null

  let aggregates: AggRow[]
  let heroes: HeroRow[]

  if (seasonId && !isNaN(seasonId)) {
    ;[aggregates, heroes] = await Promise.all([
      prisma.$queryRawUnsafe<AggRow[]>(AGG_SEASON, personId, seasonId),
      prisma.$queryRawUnsafe<HeroRow[]>(HERO_SEASON, personId, seasonId),
    ])
  } else {
    ;[aggregates, heroes] = await Promise.all([
      prisma.$queryRawUnsafe<AggRow[]>(AGG_ALL, personId),
      prisma.$queryRawUnsafe<HeroRow[]>(HERO_ALL, personId),
    ])
  }

  const row = aggregates[0]
  if (!row || Number(row.total_games) === 0) {
    return NextResponse.json({ stats: null })
  }

  const games = Number(row.total_games)
  const n = (v: bigint | number) => Number(v)

  return NextResponse.json({
    stats: {
      games,
      totals: {
        eliminations: n(row.total_eliminations),
        finalBlows: n(row.total_final_blows),
        deaths: n(row.total_deaths),
        damage: n(row.total_damage),
        heroDamage: n(row.total_hero_damage),
        healing: n(row.total_healing),
        blocked: n(row.total_blocked),
        ultsEarned: n(row.total_ults_earned),
        ultsUsed: n(row.total_ults_used),
      },
      averages: {
        eliminations: +(n(row.total_eliminations) / games).toFixed(1),
        finalBlows: +(n(row.total_final_blows) / games).toFixed(1),
        deaths: +(n(row.total_deaths) / games).toFixed(1),
        damage: Math.round(n(row.total_damage) / games),
        heroDamage: Math.round(n(row.total_hero_damage) / games),
        healing: Math.round(n(row.total_healing) / games),
        blocked: Math.round(n(row.total_blocked) / games),
        ultsEarned: +(n(row.total_ults_earned) / games).toFixed(1),
        ultsUsed: +(n(row.total_ults_used) / games).toFixed(1),
      },
      kdRatio:
        n(row.total_deaths) > 0
          ? +(n(row.total_eliminations) / n(row.total_deaths)).toFixed(2)
          : n(row.total_eliminations),
      heroes: heroes.map((h) => ({
        hero: h.player_hero,
        timePlayed: h.time_played,
        games: Number(h.games),
        eliminations: Number(h.eliminations),
        deaths: Number(h.deaths),
        damage: h.damage,
        healing: h.healing,
      })),
    },
  })
}
