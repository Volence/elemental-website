/**
 * TypeScript types for parsed ScrimTime event data.
 * Each type represents a row from the parsed CSV with named tuple elements.
 * Ported from parsertime (MIT license).
 */

import type { HeroName } from './heroes'

type PlayerTeam = 'Team 1' | 'Team 2' | (string & NonNullable<unknown>)

type EventAbility =
  | 'Primary Fire'
  | 'Secondary Fire'
  | 'Ability 1'
  | 'Ability 2'
  | 'Ultimate'
  | 'Melee'

export type DefensiveAssistRow = [
  event_type: 'defensive_assist',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  hero_duplicated: string,
]

export type DvaRemechRow = [
  event_type: 'dva_remech',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  ultimate_id: number,
]

export type EchoDuplicateEndRow = [
  event_type: 'echo_duplicate_end',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  ultimate_id: number,
]

export type EchoDuplicateStartRow = [
  event_type: 'echo_duplicate_start',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  hero_duplicated: string,
  ultimate_id: number,
]

export type HeroSpawnRow = [
  event_type: 'hero_spawn',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  previous_hero: number | null,
  hero_time_played: number,
]

export type HeroSwapRow = [
  event_type: 'hero_swap',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  previous_hero: HeroName,
  hero_time_played: number,
]

export type KillRow = [
  event_type: 'kill',
  match_time: number,
  attacker_team: PlayerTeam,
  attacker_name: string,
  attacker_hero: HeroName,
  victim_team: PlayerTeam,
  victim_name: string,
  victim_hero: HeroName,
  event_ability: EventAbility,
  event_damage: number,
  is_critical_hit: string,
  is_environmental: number | string,
]

export type MatchEndRow = [
  event_type: 'match_end',
  match_time: number,
  round_number: number,
  team_1_score: number,
  team_2_score: number,
]

export type MatchStartRow = [
  event_type: 'match_start',
  match_time: number,
  map_name: string,
  map_type: string,
  team_1_name: string,
  team_2_name: string,
]

export type MercyRezRow = [
  event_type: 'mercy_rez',
  match_time: number,
  resurrecter_team: PlayerTeam,
  resurrecter_player: string,
  resurrecter_hero: HeroName,
  resurrectee_team: PlayerTeam,
  resurrectee_player: string,
  resurrectee_hero: HeroName,
]

export type ObjectiveCapturedRow = [
  event_type: 'objective_captured',
  match_time: number,
  round_number: number,
  capturing_team: PlayerTeam,
  objective_index: number,
  control_team_1_progress: number,
  control_team_2_progress: number,
  match_time_remaining: number,
]

export type ObjectiveUpdatedRow = [
  event_type: 'objective_updated',
  match_time: number,
  round_number: number,
  previous_objective_index: number,
  current_objective_index: number,
]

export type OffensiveAssistRow = [
  event_type: 'offensive_assist',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  hero_duplicated: string,
]

export type PayloadProgressRow = [
  event_type: 'payload_progress',
  match_time: number,
  round_number: number,
  capturing_team: PlayerTeam,
  objective_index: number,
  payload_capture_progress: number,
]

export type PlayerStatRow = [
  event_type: 'player_stat',
  match_time: number,
  round_number: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  eliminations: number,
  final_blows: number,
  deaths: number,
  all_damage_dealt: number,
  barrier_damage_dealt: number,
  hero_damage_dealt: number,
  healing_dealt: number,
  healing_received: number,
  self_healing: number,
  damage_taken: number,
  damage_blocked: number,
  defensive_assists: number,
  offensive_assists: number,
  ultimates_earned: number,
  ultimates_used: number,
  multikill_best: number,
  multikills: number,
  solo_kills: number,
  objective_kills: number,
  environmental_kills: number,
  environmental_deaths: number,
  critical_hits: number,
  critical_hit_accuracy: number,
  scoped_accuracy: number,
  scoped_critical_hit_accuracy: number,
  scoped_critical_hit_kills: number,
  shots_fired: number,
  shots_hit: number,
  shots_missed: number,
  scoped_shots: number,
  scoped_shots_hit: number,
  weapon_accuracy: number,
  hero_time_played: number,
]

export type PointProgressRow = [
  event_type: 'point_progress',
  match_time: number,
  round_number: number,
  capturing_team: PlayerTeam,
  objective_index: number,
  point_capture_progress: number,
]

export type RemechChargedRow = [
  event_type: 'remech_charged',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  hero_duplicated: string,
  ultimate_id: number,
]

export type RoundEndRow = [
  event_type: 'round_end',
  match_time: number,
  round_number: number,
  capturing_team: PlayerTeam,
  team_1_score: number,
  team_2_score: number,
  objective_index: number,
  control_team_1_progress: number,
  control_team_2_progress: number,
  match_time_remaining: number,
]

export type RoundStartRow = [
  event_type: 'round_start',
  match_time: number,
  round_number: number,
  capturing_team: PlayerTeam,
  team_1_score: number,
  team_2_score: number,
  objective_index: number,
]

export type SetupCompleteRow = [
  event_type: 'setup_complete',
  match_time: number,
  round_number: number,
  match_time_remaining: number,
]

export type UltimateChargedRow = [
  event_type: 'ultimate_charged',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  hero_duplicated: string,
  ultimate_id: number,
]

export type UltimateEndRow = [
  event_type: 'ultimate_end',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  hero_duplicated: string,
  ultimate_id: number,
]

export type UltimateStartRow = [
  event_type: 'ultimate_start',
  match_time: number,
  player_team: PlayerTeam,
  player_name: string,
  player_hero: HeroName,
  hero_duplicated: string,
  ultimate_id: number,
]

/** Structured container for all parsed event data from a single map log. */
export type ParserData = {
  defensive_assist: DefensiveAssistRow[]
  dva_remech?: DvaRemechRow[]
  echo_duplicate_end?: EchoDuplicateEndRow[]
  echo_duplicate_start?: EchoDuplicateStartRow[]
  hero_spawn: HeroSpawnRow[]
  hero_swap: HeroSwapRow[]
  kill: KillRow[]
  match_end?: MatchEndRow[]
  match_start: MatchStartRow[]
  mercy_rez?: MercyRezRow[]
  objective_captured: ObjectiveCapturedRow[]
  objective_updated: ObjectiveUpdatedRow[]
  offensive_assist: OffensiveAssistRow[]
  payload_progress: PayloadProgressRow[]
  player_stat: PlayerStatRow[]
  point_progress: PointProgressRow[]
  remech_charged?: RemechChargedRow[]
  round_end: RoundEndRow[]
  round_start: RoundStartRow[]
  setup_complete: SetupCompleteRow[]
  ultimate_charged: UltimateChargedRow[]
  ultimate_end: UltimateEndRow[]
  ultimate_start: UltimateStartRow[]
}
