/**
 * Coverage rules for a match's production workflow. Every production role is a list - a match
 * can carry several observers, producers and directors - so coverage is defined by minimums
 * rather than by filled slots: at least one observer, one producer and two casters.
 *
 * Director is deliberately not part of the full-coverage test. It is an optional role staffed
 * only when enough people are available, so requiring one would leave normal matches reading
 * as short-staffed. A lone director still counts as partial coverage.
 */

import type { Where } from 'payload'

type Rel = number | string | { id?: number | string | null } | null | undefined

export interface ProductionRoles {
  assignedObservers?: Rel[] | null
  assignedProducers?: Rel[] | null
  assignedDirectors?: Rel[] | null
  assignedCasters?: Array<{ user?: Rel }> | null
  /** Name-only staff for someone who could not sign up; they count toward coverage like anyone. */
  placeholderStaff?: Array<{ role?: string | null; name?: string | null }> | null
}

function placeholderCount(pw: ProductionRoles, role: string): number {
  return (pw.placeholderStaff ?? []).filter((p) => p?.role === role && p?.name?.trim()).length
}

export type CoverageStatus = 'none' | 'partial' | 'full'

/** Minimums for `full`. Casters are two because a broadcast needs play-by-play and colour. */
export const COVERAGE_MINIMUMS = { observers: 1, producers: 1, casters: 2 } as const

export function relId(value: Rel): number | null {
  if (value === null || value === undefined) return null
  const raw = typeof value === 'object' ? value.id : value
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Ids in a role list, dropping anything unresolvable. */
export function roleIds(list: Rel[] | null | undefined): number[] {
  return (list ?? []).map(relId).filter((id): id is number => id !== null)
}

function casterIds(pw: ProductionRoles): number[] {
  return roleIds((pw.assignedCasters ?? []).map((c) => c?.user))
}

export function computeCoverageStatus(pw: ProductionRoles): CoverageStatus {
  const observers = roleIds(pw.assignedObservers).length + placeholderCount(pw, 'observer')
  const producers = roleIds(pw.assignedProducers).length + placeholderCount(pw, 'producer')
  const directors = roleIds(pw.assignedDirectors).length + placeholderCount(pw, 'director')
  const casters = casterIds(pw).length + placeholderCount(pw, 'caster')

  if (
    observers >= COVERAGE_MINIMUMS.observers &&
    producers >= COVERAGE_MINIMUMS.producers &&
    casters >= COVERAGE_MINIMUMS.casters
  ) {
    return 'full'
  }
  if (observers + producers + directors + casters > 0) return 'partial'
  return 'none'
}

/**
 * People assigned as both producer and director on one match. The two jobs run at the same
 * time - the producer runs the broadcast, the director calls which observer's view goes out -
 * so one person cannot hold both.
 */
export function producerDirectorOverlap(pw: ProductionRoles): number[] {
  const producers = new Set(roleIds(pw.assignedProducers))
  return roleIds(pw.assignedDirectors).filter((id) => producers.has(id))
}

/**
 * What "on the broadcast schedule" means everywhere a match is listed as upcoming broadcast: ticked
 * in the Schedule Builder AND staffed. The builder and the Discord schedule post only show matches
 * with coverage, so a match that was ticked and then lost its staff vanished from both while still
 * reading as scheduled on the site, the calendar and the social Coming up list. Spread into a
 * Payload `and` clause.
 */
export const ON_BROADCAST_SCHEDULE: Where[] = [
  { 'productionWorkflow.includeInSchedule': { equals: true } },
  { 'productionWorkflow.coverageStatus': { in: ['partial', 'full'] } },
]
