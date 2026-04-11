/**
 * Utilities for normalizing availability data from different sources
 * into the shared VoteData[] format consumed by the ScheduleEditor.
 */

import type { VoteData } from './types'

/**
 * An individual response from the calendar.
 * Matches the shape stored in `AvailabilityCalendar.responses`.
 */
interface CalendarResponse {
  discordId: string
  discordUsername: string
  discordAvatar?: string
  respondedAt: string
  selections: Record<string, Record<string, 'available' | 'maybe'>>
  notes?: string
}

/**
 * Convert a 24h time string (e.g. "18:00") to a friendly label (e.g. "6-8 PM").
 * Assumes 2-hour blocks.
 */
function formatTimeSlotLabel(time24: string): string {
  const hour = parseInt(time24.split(':')[0], 10)
  if (isNaN(hour)) return time24

  const startHour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const endHour = hour + 2
  const endHour12 = endHour > 12 ? endHour - 12 : endHour === 0 ? 12 : endHour
  const period = hour >= 12 ? 'PM' : 'AM'
  const endPeriod = endHour >= 12 ? 'PM' : 'AM'

  if (period === endPeriod) {
    return `${startHour12}-${endHour12} ${period}`
  }
  return `${startHour12} ${period}-${endHour12} ${endPeriod}`
}

/**
 * Normalize availability calendar responses into VoteData[].
 *
 * Calendar responses are stored as:
 *   { discordId, discordUsername, selections: { "2026-04-14": { "18:00": "available", "20:00": "maybe" } } }
 *
 * We convert to VoteData[]:
 *   { date: "Monday April 14th", voterCount: 5, voters: [...], timeSlots: [...] }
 *
 * Calendar data is date+slot granular; polls are date-only.
 * We provide BOTH day-level aggregation (for badges) and per-slot breakdown (for multi-block creation).
 */
export function normalizeCalendarToVoteData(
  responses: CalendarResponse[],
  dateRangeStart: string,
  dateRangeEnd: string,
  /** Configured time slots from the document (uses response-based discovery as fallback) */
  configuredSlots?: Array<{ startTime: string; label: string }>,
): VoteData[] {
  if (!responses || responses.length === 0) return []

  // Extract just the date part in case the API returns full ISO timestamps
  const startDate = dateRangeStart.split('T')[0]
  const endDate = dateRangeEnd.split('T')[0]
  
  // Build the list of dates in the range
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const dates: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  // Use configured time slots if available, otherwise discover from responses
  let slotEntries: Array<{ key: string; label: string }>

  if (configuredSlots && configuredSlots.length > 0) {
    slotEntries = configuredSlots.map(s => ({
      key: s.startTime,
      label: s.label,
    }))
  } else {
    // Fallback: discover from response data
    const allTimeSlots = new Set<string>()
    for (const response of responses) {
      for (const daySlots of Object.values(response.selections || {})) {
        for (const slotKey of Object.keys(daySlots)) {
          allTimeSlots.add(slotKey)
        }
      }
    }
    slotEntries = Array.from(allTimeSlots).sort().map(key => ({
      key,
      label: formatTimeSlotLabel(key),
    }))
  }

  // For each date, find who is available (per-slot and aggregate)
  return dates.map((date) => {
    const dateKey = date.toISOString().split('T')[0] // "2026-04-14"
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    const monthName = date.toLocaleDateString('en-US', { month: 'long' })
    const dayNum = date.getDate()
    const suffix = ['th', 'st', 'nd', 'rd'][
      (dayNum % 10 > 3 || Math.floor((dayNum % 100) / 10) === 1) ? 0 : dayNum % 10
    ]
    const dateLabel = `${dayName} ${monthName} ${dayNum}${suffix}`

    // Day-level aggregate: anyone available in ANY slot
    const availableVoters: VoteData['voters'] = []
    // Per-slot breakdown
    const timeSlotData: NonNullable<VoteData['timeSlots']> = []

    for (const { key: slotKey, label: slotLabel } of slotEntries) {
      const slotVoters: VoteData['voters'] = []
      
      for (const response of responses) {
        const daySlots = response.selections?.[dateKey]
        if (!daySlots) continue
        
        const status = daySlots[slotKey]
        if (status === 'available' || status === 'maybe') {
          slotVoters.push({
            id: response.discordId,
            username: response.discordUsername,
            displayName: response.discordUsername,
          })
        }
      }

      timeSlotData.push({
        time: slotLabel,
        voters: slotVoters,
      })
    }

    // Aggregate: unique voters across all slots
    const seenIds = new Set<string>()
    for (const response of responses) {
      const daySlots = response.selections?.[dateKey]
      if (!daySlots) continue
      
      const hasAvailability = Object.values(daySlots).some(
        (status) => status === 'available' || status === 'maybe',
      )

      if (hasAvailability && !seenIds.has(response.discordId)) {
        seenIds.add(response.discordId)
        availableVoters.push({
          id: response.discordId,
          username: response.discordUsername,
          displayName: response.discordUsername,
        })
      }
    }

    return {
      date: dateLabel,
      voterCount: availableVoters.length,
      voters: availableVoters,
      timeSlots: timeSlotData.length > 0 ? timeSlotData : undefined,
    }
  })
}
