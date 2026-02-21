/**
 * Storage layer for scrim event data.
 * Takes parsed ParserData and bulk-inserts all events into the database via Prisma.
 *
 * Ported from parsertime (MIT license) — adapted to use our scrim-prefixed schema.
 */

import prisma from '@/lib/prisma'
import type { ParserData } from './types'
import { toTitleCase } from './parser'

export interface CreateScrimOptions {
  name: string
  date: Date
  payloadTeamId: number | null
  /** Optional second team for internal scrims */
  payloadTeamId2?: number | null
  creatorEmail: string
  /** Optional override for opponent team name */
  opponentName?: string | null
  maps: {
    fileContent: string
    parsedData: ParserData
    replayCode?: string
  }[]
  /** Maps in-game player_name → Payload Person ID (team 1) */
  playerMappings?: Record<string, number>
  /** Maps in-game player_name → Payload Person ID (team 2, for internal scrims) */
  playerMappings2?: Record<string, number>
}

/**
 * Creates a new scrim record with all its maps and event data.
 * This is the main entry point for processing uploaded log files.
 */
export async function createScrimFromParsedData(options: CreateScrimOptions) {
  const scrim = await prisma.scrim.create({
    data: {
      name: options.name,
      date: options.date,
      payloadTeamId: options.payloadTeamId,
      payloadTeamId2: options.payloadTeamId2 || null,
      creatorEmail: options.creatorEmail,
      opponentName: options.opponentName || null,
    },
  })

  const results = []

  for (const mapUpload of options.maps) {
    try {
      const mapResult = await createMapFromParsedData({
        scrimId: scrim.id,
        parsedData: mapUpload.parsedData,
        replayCode: mapUpload.replayCode,
        playerMappings: options.playerMappings,
        playerMappings2: options.playerMappings2,
      })
      results.push(mapResult)
    } catch (error) {
      // If any map fails, clean up the entire scrim
      console.error(`Error creating map for scrim ${scrim.id}:`, error)
      await prisma.scrim.delete({ where: { id: scrim.id } })
      throw new Error(
        `Failed to process map: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  return { scrim, maps: results }
}

interface CreateMapOptions {
  scrimId: number
  parsedData: ParserData
  replayCode?: string
  playerMappings?: Record<string, number>
  playerMappings2?: Record<string, number>
}

/**
 * Creates a single map and all its event data within a scrim.
 */
async function createMapFromParsedData(options: CreateMapOptions) {
  const { scrimId, parsedData, replayCode } = options

  // Extract map name from match_start event
  const mapName = parsedData.match_start?.[0]?.[2]
    ? toTitleCase(String(parsedData.match_start[0][2]))
    : 'Unknown Map'

  const scrimMap = await prisma.scrimMap.create({
    data: {
      name: mapName,
      scrimId,
      replayCode: replayCode || null,
    },
  })

  const mapData = await prisma.scrimMapData.create({
    data: {
      scrimId,
      mapId: scrimMap.id,
    },
  })

  // Insert all event types in parallel for performance
  await Promise.all([
    insertDefensiveAssists(parsedData, scrimId, mapData.id),
    insertDvaRemechs(parsedData, scrimId, mapData.id),
    insertEchoDuplicateEnds(parsedData, scrimId, mapData.id),
    insertEchoDuplicateStarts(parsedData, scrimId, mapData.id),
    insertHeroSpawns(parsedData, scrimId, mapData.id),
    insertHeroSwaps(parsedData, scrimId, mapData.id),
    insertKills(parsedData, scrimId, mapData.id),
    insertMatchEnds(parsedData, scrimId, mapData.id),
    insertMatchStarts(parsedData, scrimId, mapData.id),
    insertMercyRezs(parsedData, scrimId, mapData.id),
    insertObjectivesCaptured(parsedData, scrimId, mapData.id),
    insertObjectivesUpdated(parsedData, scrimId, mapData.id),
    insertOffensiveAssists(parsedData, scrimId, mapData.id),
    insertPayloadProgress(parsedData, scrimId, mapData.id),
    insertPlayerStats(parsedData, scrimId, mapData.id, options.playerMappings, options.playerMappings2),
    insertPointProgress(parsedData, scrimId, mapData.id),
    insertRemechCharged(parsedData, scrimId, mapData.id),
    insertRoundEnds(parsedData, scrimId, mapData.id),
    insertRoundStarts(parsedData, scrimId, mapData.id),
    insertSetupCompletes(parsedData, scrimId, mapData.id),
    insertUltimateCharged(parsedData, scrimId, mapData.id),
    insertUltimateEnds(parsedData, scrimId, mapData.id),
    insertUltimateStarts(parsedData, scrimId, mapData.id),
  ])

  return { scrimMap, mapData }
}

// ============================================================================
// Bulk insert functions for each event type
// Each follows the same pattern: check if data exists → map to DB shape → createMany
// ============================================================================

async function insertDefensiveAssists(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.defensive_assist?.length) return
  await prisma.scrimDefensiveAssist.createMany({
    data: data.defensive_assist.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      hero_duplicated: String(row[5]),
      mapDataId,
    })),
  })
}

async function insertDvaRemechs(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.dva_remech?.length) return
  await prisma.scrimDvaRemech.createMany({
    data: data.dva_remech.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      ultimate_id: Number(row[5]),
      mapDataId,
    })),
  })
}

async function insertEchoDuplicateEnds(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.echo_duplicate_end?.length) return
  await prisma.scrimEchoDuplicateEnd.createMany({
    data: data.echo_duplicate_end.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      ultimate_id: Number(row[5]),
      mapDataId,
    })),
  })
}

async function insertEchoDuplicateStarts(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.echo_duplicate_start?.length) return
  await prisma.scrimEchoDuplicateStart.createMany({
    data: data.echo_duplicate_start.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      hero_duplicated: String(row[5]),
      ultimate_id: Number(row[6]),
      mapDataId,
    })),
  })
}

async function insertHeroSpawns(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.hero_spawn?.length) return
  await prisma.scrimHeroSpawn.createMany({
    data: data.hero_spawn.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      previous_hero: row[5] != null ? Number(row[5]) : null,
      hero_time_played: Number(row[6]),
      mapDataId,
    })),
  })
}

async function insertHeroSwaps(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.hero_swap?.length) return
  await prisma.scrimHeroSwap.createMany({
    data: data.hero_swap.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      previous_hero: String(row[5]),
      hero_time_played: Number(row[6]),
      mapDataId,
    })),
  })
}

async function insertKills(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.kill?.length) return
  await prisma.scrimKill.createMany({
    data: data.kill.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      attacker_team: String(row[2]),
      attacker_name: String(row[3]),
      attacker_hero: String(row[4]),
      victim_team: String(row[5]),
      victim_name: String(row[6]),
      victim_hero: String(row[7]),
      event_ability: String(row[8]),
      event_damage: Number(row[9]),
      is_critical_hit: String(row[10]),
      is_environmental: String(row[11]),
      mapDataId,
    })),
  })
}

async function insertMatchEnds(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.match_end?.length) return
  await prisma.scrimMatchEnd.createMany({
    data: data.match_end.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      team_1_score: Number(row[3]),
      team_2_score: Number(row[4]),
      mapDataId,
    })),
  })
}

async function insertMatchStarts(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.match_start?.length) return
  await prisma.scrimMatchStart.createMany({
    data: data.match_start.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      map_name: String(row[2]),
      map_type: String(row[3]) as 'Clash' | 'Control' | 'Escort' | 'Flashpoint' | 'Hybrid' | 'Push',
      team_1_name: String(row[4]),
      team_2_name: String(row[5]),
      mapDataId,
    })),
  })
}

async function insertMercyRezs(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.mercy_rez?.length) return
  await prisma.scrimMercyRez.createMany({
    data: data.mercy_rez.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      resurrecter_team: String(row[2]),
      resurrecter_player: String(row[3]),
      resurrecter_hero: String(row[4]),
      resurrectee_team: String(row[5]),
      resurrectee_player: String(row[6]),
      resurrectee_hero: String(row[7]),
      mapDataId,
    })),
  })
}

async function insertObjectivesCaptured(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.objective_captured?.length) return
  await prisma.scrimObjectiveCaptured.createMany({
    data: data.objective_captured.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      capturing_team: String(row[3]),
      objective_index: Number(row[4]),
      control_team_1_progress: Number(row[5]),
      control_team_2_progress: Number(row[6]),
      match_time_remaining: Number(row[7]),
      mapDataId,
    })),
  })
}

async function insertObjectivesUpdated(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.objective_updated?.length) return
  await prisma.scrimObjectiveUpdated.createMany({
    data: data.objective_updated.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      previous_objective_index: Number(row[3]),
      current_objective_index: Number(row[4]),
      mapDataId,
    })),
  })
}

async function insertOffensiveAssists(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.offensive_assist?.length) return
  await prisma.scrimOffensiveAssist.createMany({
    data: data.offensive_assist.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      hero_duplicated: String(row[5]),
      mapDataId,
    })),
  })
}

async function insertPayloadProgress(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.payload_progress?.length) return
  await prisma.scrimPayloadProgress.createMany({
    data: data.payload_progress.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      capturing_team: String(row[3]),
      objective_index: Number(row[4]),
      payload_capture_progress: Number(row[5]),
      mapDataId,
    })),
  })
}

async function insertPlayerStats(data: ParserData, scrimId: number, mapDataId: number, playerMappings?: Record<string, number>, playerMappings2?: Record<string, number>) {
  if (!data.player_stat?.length) return
  // Merge both mapping dicts — team 1 and team 2 mappings
  const allMappings = { ...playerMappings, ...playerMappings2 }
  await prisma.scrimPlayerStat.createMany({
    data: data.player_stat.map((row) => {
      const playerName = String(row[4])
      return {
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      player_team: String(row[3]),
      player_name: playerName,
      personId: allMappings?.[playerName] ?? null,
      player_hero: String(row[5]),
      eliminations: Number(row[6]),
      final_blows: Number(row[7]),
      deaths: Number(row[8]),
      all_damage_dealt: Number(row[9]),
      barrier_damage_dealt: Number(row[10]),
      hero_damage_dealt: Number(row[11]),
      healing_dealt: Number(row[12]),
      healing_received: Number(row[13]),
      self_healing: Number(row[14]),
      damage_taken: Number(row[15]),
      damage_blocked: Number(row[16]),
      defensive_assists: Number(row[17]),
      offensive_assists: Number(row[18]),
      ultimates_earned: Number(row[19]),
      ultimates_used: Number(row[20]),
      multikill_best: Number(row[21]),
      multikills: Number(row[22]),
      solo_kills: Number(row[23]),
      objective_kills: Number(row[24]),
      environmental_kills: Number(row[25]),
      environmental_deaths: Number(row[26]),
      critical_hits: Number(row[27]),
      critical_hit_accuracy: Number(row[28]),
      scoped_accuracy: Number(row[29]),
      scoped_critical_hit_accuracy: Number(row[30]),
      scoped_critical_hit_kills: Number(row[31]),
      shots_fired: Number(row[32]),
      shots_hit: Number(row[33]),
      shots_missed: Number(row[34]),
      scoped_shots: Number(row[35]),
      scoped_shots_hit: Number(row[36]),
      weapon_accuracy: Number(row[37]),
      hero_time_played: Number(row[38]),
      mapDataId,
    }}),
  })
}

async function insertPointProgress(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.point_progress?.length) return
  await prisma.scrimPointProgress.createMany({
    data: data.point_progress.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      capturing_team: String(row[3]),
      objective_index: Number(row[4]),
      point_capture_progress: Number(row[5]),
      mapDataId,
    })),
  })
}

async function insertRemechCharged(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.remech_charged?.length) return
  await prisma.scrimRemechCharged.createMany({
    data: data.remech_charged.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      hero_duplicated: String(row[5]),
      ultimate_id: Number(row[6]),
      mapDataId,
    })),
  })
}

async function insertRoundEnds(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.round_end?.length) return
  await prisma.scrimRoundEnd.createMany({
    data: data.round_end.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      capturing_team: String(row[3]),
      team_1_score: Number(row[4]),
      team_2_score: Number(row[5]),
      objective_index: Number(row[6]),
      control_team_1_progress: Number(row[7]),
      control_team_2_progress: Number(row[8]),
      match_time_remaining: Number(row[9]),
      mapDataId,
    })),
  })
}

async function insertRoundStarts(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.round_start?.length) return
  await prisma.scrimRoundStart.createMany({
    data: data.round_start.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      capturing_team: String(row[3]),
      team_1_score: Number(row[4]),
      team_2_score: Number(row[5]),
      objective_index: Number(row[6]),
      mapDataId,
    })),
  })
}

async function insertSetupCompletes(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.setup_complete?.length) return
  await prisma.scrimSetupComplete.createMany({
    data: data.setup_complete.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      round_number: Number(row[2]),
      match_time_remaining: Number(row[3]),
      mapDataId,
    })),
  })
}

async function insertUltimateCharged(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.ultimate_charged?.length) return
  await prisma.scrimUltimateCharged.createMany({
    data: data.ultimate_charged.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      hero_duplicated: String(row[5]),
      ultimate_id: Number(row[6]),
      mapDataId,
    })),
  })
}

async function insertUltimateEnds(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.ultimate_end?.length) return
  await prisma.scrimUltimateEnd.createMany({
    data: data.ultimate_end.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      hero_duplicated: String(row[5]),
      ultimate_id: Number(row[6]),
      mapDataId,
    })),
  })
}

async function insertUltimateStarts(data: ParserData, scrimId: number, mapDataId: number) {
  if (!data.ultimate_start?.length) return
  await prisma.scrimUltimateStart.createMany({
    data: data.ultimate_start.map((row) => ({
      scrimId,
      match_time: Number(row[1]),
      player_team: String(row[2]),
      player_name: String(row[3]),
      player_hero: String(row[4]),
      hero_duplicated: String(row[5]),
      ultimate_id: Number(row[6]),
      mapDataId,
    })),
  })
}
