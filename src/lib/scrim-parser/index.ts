/**
 * Scrim Parser Library — Barrel Export
 *
 * Provides the complete pipeline for processing ScrimTime log files:
 * 1. parseScrimLog() — Parse raw .txt content into structured events
 * 2. createScrimFromParsedData() — Store parsed data in the database
 */

export { parseScrimLog, toTitleCase } from './parser'
export { createScrimFromParsedData } from './storage'
export type { CreateScrimOptions } from './storage'
export type { ParserData } from './types'
export { heroRoleMapping } from './heroes'
export type { HeroName, HeroRole } from './heroes'
