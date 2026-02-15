/**
 * Scrim Parser Library — Barrel Export
 *
 * Provides the complete pipeline for processing ScrimTime log files:
 * 1. parseScrimLog() — Parse raw .txt content into structured events
 * 2. createScrimFromParsedData() — Store parsed data in the database
 * 3. calculateStats() / calculateStatsForMap() — Compute advanced analytics
 */

// ── Parsing ──────────────────────────────────────────────────────────
export { parseScrimLog, toTitleCase } from './parser'

// ── Storage ──────────────────────────────────────────────────────────
export { createScrimFromParsedData } from './storage'
export type { CreateScrimOptions } from './storage'

// ── Types ────────────────────────────────────────────────────────────
export type { ParserData } from './types'

// ── Heroes ───────────────────────────────────────────────────────────
export { heroRoleMapping } from './heroes'
export type { HeroName, HeroRole } from './heroes'

// ── Stat Calculation ─────────────────────────────────────────────────
export { calculateStats, calculateStatsForMap } from './calculate-stats'
export type { CalculatedPlayerStats } from './calculate-stats'

// ── Analytics ────────────────────────────────────────────────────────
export {
  getAverageUltChargeTime,
  getAverageTimeToUseUlt,
  getKillsPerUltimate,
  getDuelWinrates,
  calculateDroughtTime,
  getAjaxes,
  calculateXFactor,
} from './analytics'
export type { AggregatedDuel } from './analytics'

// ── Data Access ──────────────────────────────────────────────────────
export { getFinalRoundStats, getPlayerFinalStats } from './data-access'
export type { PlayerStatRow } from './data-access'

// ── Utilities ────────────────────────────────────────────────────────
export { round, removeDuplicateRows, groupKillsIntoFights } from './utils'
export type { Fight, FightKill } from './utils'
