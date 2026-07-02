/**
 * Shared "which raw log side is ours" resolution for scrim analytics.
 *
 * The workshop log only knows side labels (often "Team 1"/"Team 2"); linking
 * them to real teams goes through roster membership of the players' personIds.
 * Two failure modes this module guards against:
 *
 * - Cross-rostered players: someone on our roster ringing for the opponent
 *   used to make first-row-wins detection nondeterministic. We take a
 *   majority vote instead: the side fielding more of the team's rostered
 *   players wins; a tie stays unresolved.
 * - Dual-team scrims where only one team's players were mapped at upload:
 *   if the viewed team is unresolved but the other linked team resolved,
 *   ours is the opposite side.
 */

export type RosterSideRow = {
  mapDataId: number
  teamId: number
  /** Raw side label from the log (player_team). */
  side: string
  /** Number of distinct rostered players of teamId seen on that side. */
  players: number
}

const key = (mapDataId: number, teamId: number) => `${mapDataId}:${teamId}`

/**
 * Collapse roster-side rows into a per-(map, team) side decision by majority
 * vote. Ties resolve to nothing (absent from the map).
 */
export function buildSideLookup(rows: RosterSideRow[]): Map<string, string> {
  const byMapTeam = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const k = key(r.mapDataId, r.teamId)
    if (!byMapTeam.has(k)) byMapTeam.set(k, new Map())
    const sides = byMapTeam.get(k)!
    sides.set(r.side, (sides.get(r.side) ?? 0) + r.players)
  }

  const result = new Map<string, string>()
  for (const [k, sides] of byMapTeam) {
    let best: string | null = null
    let bestCount = 0
    let tied = false
    for (const [side, count] of sides) {
      if (count > bestCount) {
        best = side
        bestCount = count
        tied = false
      } else if (count === bestCount) {
        tied = true
      }
    }
    if (best != null && !tied) result.set(k, best)
  }
  return result
}

/**
 * Resolve the viewed team's raw side on a map: directly via its own roster,
 * or by inverting the other linked team's resolved side. Returns null when
 * neither team resolves (callers choose their own fallback).
 */
export function resolveOurSide(opts: {
  mapDataId: number
  viewTeamId: number
  otherTeamId: number | null
  sides: Map<string, string>
  rawTeam1: string
  rawTeam2: string
}): string | null {
  const direct = opts.sides.get(key(opts.mapDataId, opts.viewTeamId))
  if (direct != null) return direct

  if (opts.otherTeamId != null) {
    const theirs = opts.sides.get(key(opts.mapDataId, opts.otherTeamId))
    if (theirs === opts.rawTeam1) return opts.rawTeam2
    if (theirs === opts.rawTeam2) return opts.rawTeam1
  }
  return null
}
