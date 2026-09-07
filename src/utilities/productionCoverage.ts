/**
 * Coverage rules for a match's production workflow. Every production role is a list - a match
 * can carry several observers, producers and directors - so coverage is defined by minimums
 * rather than by filled slots: at least one observer, one producer and two casters.
 *
 * Director is deliberately not part of the full-coverage test. It is an optional role staffed
 * only when enough people are available, so requiring one would leave normal matches reading
 * as short-staffed. A lone director still counts as partial coverage.
 */

type Rel = number | string | { id?: number | string | null } | null | undefined

export interface ProductionRoles {
  assignedObservers?: Rel[] | null
  assignedProducers?: Rel[] | null
  assignedDirectors?: Rel[] | null
  assignedCasters?: Array<{ user?: Rel }> | null
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
  const observers = roleIds(pw.assignedObservers).length
  const producers = roleIds(pw.assignedProducers).length
  const directors = roleIds(pw.assignedDirectors).length
  const casters = casterIds(pw).length

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
