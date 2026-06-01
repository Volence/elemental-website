/**
 * A player subbed out after a second or two leaves a final-round stats row
 * with zero across every counting stat. Such "phantom" appearances pollute a
 * player's map history and drag down per-map averages, so they are excluded
 * from player-detail aggregation.
 */
export interface MapParticipationStats {
  eliminations: number
  final_blows: number
  deaths: number
  hero_damage_dealt: number
  healing_dealt: number
}

export function playedMeaningfully(row: MapParticipationStats): boolean {
  return (
    row.eliminations > 0 ||
    row.final_blows > 0 ||
    row.deaths > 0 ||
    row.hero_damage_dealt > 0 ||
    row.healing_dealt > 0
  )
}
