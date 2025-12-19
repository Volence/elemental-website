/**
 * Calculate the display status of a match based on its date and manual status
 * @param matchDate - The scheduled date/time of the match
 * @param manualStatus - The manual status ('scheduled' or 'cancelled')
 * @returns The display status ('upcoming', 'live', 'completed', or 'cancelled')
 */
export function getMatchStatus(
  matchDate: string | Date,
  manualStatus: 'scheduled' | 'cancelled',
): 'upcoming' | 'live' | 'completed' | 'cancelled' {
  // If manually cancelled, always show as cancelled
  if (manualStatus === 'cancelled') {
    return 'cancelled'
  }

  const now = new Date()
  const matchDateTime = new Date(matchDate)
  const twoHoursInMs = 2 * 60 * 60 * 1000

  // Calculate time difference
  const timeDiff = matchDateTime.getTime() - now.getTime()
  const timeElapsed = now.getTime() - matchDateTime.getTime()

  // Live: Match started and less than 2 hours have passed
  if (timeDiff <= 0 && timeElapsed <= twoHoursInMs) {
    return 'live'
  }

  // Completed: More than 2 hours have passed since match time
  if (timeElapsed > twoHoursInMs) {
    return 'completed'
  }

  // Upcoming: Match hasn't started yet
  return 'upcoming'
}




