export const RELEASE_DAY_OPTIONS = [
  { label: 'Monday (full week ahead)', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday (default)', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
] as const

export const DEFAULT_RELEASE_DAY = 'friday'

// Monday-based index (Mon=0 .. Sun=6), matching the Mon-Sun schedule week
const RELEASE_DAY_INDEX: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

/**
 * Whether next week's availability calendar should be released.
 * True from the team's configured release day through the end of the week
 * (Sunday), so a missed release day still releases on the next visit.
 */
export function isNextWeekReleased(now: Date, releaseDay?: string | null): boolean {
  const releaseIdx =
    RELEASE_DAY_INDEX[releaseDay ?? ''] ?? RELEASE_DAY_INDEX[DEFAULT_RELEASE_DAY]
  const todayIdx = (now.getDay() + 6) % 7
  return todayIdx >= releaseIdx
}

export function releaseDayLabel(releaseDay?: string | null): string {
  const day =
    releaseDay && releaseDay in RELEASE_DAY_INDEX ? releaseDay : DEFAULT_RELEASE_DAY
  return day.charAt(0).toUpperCase() + day.slice(1)
}
