/**
 * Scrim analytics utility functions.
 * Ported from parsertime — framework-free versions.
 */

import prisma from '@/lib/prisma'

// ── Rounding ─────────────────────────────────────────────────────────

/** Rounds a number to two decimal places. */
export function round(value: number): number {
  if (!isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// ── Deduplication ────────────────────────────────────────────────────

/**
 * Removes duplicate rows from an array of objects based on their non-id properties.
 * Keeps the first occurrence of each unique set of non-id properties.
 */
export function removeDuplicateRows<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = row
    const key = JSON.stringify(rest)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Kill type for fight grouping ─────────────────────────────────────

export type FightKill = {
  id: number
  scrimId: number
  match_time: number
  attacker_team: string
  attacker_name: string
  attacker_hero: string
  victim_team: string
  victim_name: string
  victim_hero: string
  event_ability: string
  event_damage: number
  is_critical_hit: string
  is_environmental: string
  mapDataId: number
}

export type Fight = {
  kills: FightKill[]
  start: number
  end: number
}

// ── Fight Grouping ───────────────────────────────────────────────────

/**
 * Groups kills and Mercy rezzes into fight windows.
 * A new fight starts when there is a >15 second gap between events.
 */
export async function groupKillsIntoFights(mapId: number): Promise<Fight[]> {
  const [kills, rezzes] = await Promise.all([
    prisma.scrimKill.findMany({ where: { mapDataId: mapId } }),
    prisma.scrimMercyRez.findMany({ where: { mapDataId: mapId } }),
  ])

  if (kills.length === 0 && rezzes.length === 0) return []

  // Normalize rezzes to the same shape as kills
  const events: FightKill[] = [
    ...kills.map((k) => ({
      id: k.id,
      scrimId: k.scrimId,
      match_time: k.match_time,
      attacker_team: k.attacker_team,
      attacker_name: k.attacker_name,
      attacker_hero: k.attacker_hero,
      victim_team: k.victim_team,
      victim_name: k.victim_name,
      victim_hero: k.victim_hero,
      event_ability: k.event_ability,
      event_damage: k.event_damage,
      is_critical_hit: k.is_critical_hit,
      is_environmental: k.is_environmental,
      mapDataId: k.mapDataId ?? 0,
    })),
    ...rezzes.map((r) => ({
      id: r.id,
      scrimId: r.scrimId,
      match_time: r.match_time,
      attacker_team: r.resurrecter_team,
      attacker_name: r.resurrecter_player,
      attacker_hero: r.resurrecter_hero,
      victim_team: r.resurrectee_team ?? '',
      victim_name: r.resurrectee_player ?? '',
      victim_hero: r.resurrectee_hero ?? '',
      event_ability: 'Resurrect',
      event_damage: 0,
      is_critical_hit: '0',
      is_environmental: '0',
      mapDataId: r.mapDataId ?? 0,
    })),
  ]

  events.sort((a, b) => a.match_time - b.match_time)

  const fights: Fight[] = []
  let current: Fight | null = null

  for (const event of events) {
    if (!current || event.match_time - current.end > 15) {
      current = { kills: [event], start: event.match_time, end: event.match_time }
      fights.push(current)
    } else {
      current.kills.push(event)
      current.end = event.match_time
    }
  }

  return fights
}
