/**
 * Resolving a raw scrim player name to the right stats query.
 *
 * A raw scrim name can collide with a People record that was never linked to
 * those stat rows: people.name = 'Nojosa' exists, but every
 * scrim_player_stats row for 'Nojosa' still has personId = NULL. A name match
 * alone is therefore not proof the Person owns any stats, and querying by
 * personId in that case finds nothing while the rows sit under the raw name.
 *
 * Only route to the Person when that Person actually owns stat rows.
 */

export type PlayerStatsTarget =
  | { kind: 'person'; personId: number }
  | { kind: 'name'; playerName: string }

export interface PlayerStatsTargetInput {
  playerName: string
  personId: number | null
  personHasLinkedStats: boolean
}

export function resolvePlayerStatsTarget(input: PlayerStatsTargetInput): PlayerStatsTarget {
  if (input.personId !== null && input.personHasLinkedStats) {
    return { kind: 'person', personId: input.personId }
  }
  return { kind: 'name', playerName: input.playerName }
}
