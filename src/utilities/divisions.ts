/**
 * FACEIT league divisions, highest first. One list so the ordering, the
 * select options and the "which division is this rating" guess agree
 * everywhere. Intermediate arrived in 2026-09 between Advanced and Open
 * (NA and EMEA). Team ratings are free text ("FACEIT Intermediate", "4.5K"),
 * so the guess is a case-insensitive keyword match.
 */
export const FACEIT_DIVISIONS = ['Masters', 'Expert', 'Advanced', 'Intermediate', 'Open'] as const
export type FaceitDivision = (typeof FACEIT_DIVISIONS)[number]

export const DIVISION_OPTIONS = FACEIT_DIVISIONS.map((d) => ({ label: d, value: d }))

export function isFaceitDivision(value: unknown): value is FaceitDivision {
  return typeof value === 'string' && (FACEIT_DIVISIONS as readonly string[]).includes(value)
}

/** 0 for Masters ... 4 for Open; unknown values sort after every division. */
export function divisionRank(division: string | null | undefined): number {
  const i = FACEIT_DIVISIONS.indexOf((division ?? '') as FaceitDivision)
  return i === -1 ? FACEIT_DIVISIONS.length : i
}

/**
 * Division named in a free-text rating, or null when the rating is numeric
 * ("4.5K") or empty. "adv" is tolerated for Advanced; "inter" for Intermediate.
 */
export function divisionFromRating(rating: string | number | null | undefined): FaceitDivision | null {
  if (rating === null || rating === undefined) return null
  const r = String(rating).toLowerCase()
  if (r.includes('master')) return 'Masters'
  if (r.includes('expert')) return 'Expert'
  if (r.includes('advanced') || /\badv\b/.test(r)) return 'Advanced'
  if (r.includes('intermediate') || /\binter\b/.test(r)) return 'Intermediate'
  if (r.includes('open')) return 'Open'
  return null
}
