import type { Team } from './getTeams'

/**
 * Get region priority for sorting (lower number = higher priority)
 */
function getRegionPriority(region?: string): number {
  switch (region) {
    case 'NA':
      return 1
    case 'EU':
      return 2
    case 'SA':
      return 3
    default:
      return 4 // Teams without region go last
  }
}

/**
 * Get rating priority for sorting (lower number = higher priority)
 */
function getRatingPriority(rating?: string): number {
  if (!rating) return 999 // Teams without rating go last

  const upperRating = rating.toUpperCase()

  // FACEIT tiers (highest priority)
  if (upperRating.includes('FACEIT MASTERS')) return 1
  if (upperRating.includes('FACEIT EXPERT')) return 2
  if (upperRating.includes('FACEIT ADVANCED')) return 3

  // Numeric ratings (extract number and convert to priority)
  // Higher numbers = lower priority number (so 4.5K sorts before 4.4K)
  const numericMatch = rating.match(/(\d+\.?\d*)[Kk]?/)
  if (numericMatch) {
    const numericValue = parseFloat(numericMatch[1])
    // Return negative so higher numbers sort first, but offset by 10 to be after FACEIT tiers
    return 10 - numericValue
  }

  // Other ratings (like "T3") go after numeric ratings
  return 100
}

/**
 * Sort teams by region (NA, EU, SA) then by rating within each region
 */
export function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    // First sort by region
    const regionA = getRegionPriority(a.region)
    const regionB = getRegionPriority(b.region)

    if (regionA !== regionB) {
      return regionA - regionB
    }

    // Within same region, sort by rating
    const ratingA = getRatingPriority(a.rating)
    const ratingB = getRatingPriority(b.rating)

    return ratingA - ratingB
  })
}

