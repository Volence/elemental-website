export interface AvailabilityResponseRecord {
  discordId: string
  discordUsername: string
  discordAvatar?: string
  respondedAt: string
  selections: Record<string, Record<string, 'available' | 'maybe'>>
  notes?: string
  // Manager-managed fields. Set from the schedule page, never by the player
  // submitting availability, so they must survive a re-submit.
  scheduleRole?: string
  scheduleStatus?: string
}

/** Fields only the manager sets; carried over when a player re-submits. */
const MANAGER_FIELDS: (keyof AvailabilityResponseRecord)[] = ['scheduleRole', 'scheduleStatus']

export function mergeAvailabilityResponse(
  existing: Partial<AvailabilityResponseRecord> | undefined,
  incoming: AvailabilityResponseRecord,
): AvailabilityResponseRecord {
  if (!existing) return incoming
  const merged: AvailabilityResponseRecord = { ...incoming }
  for (const key of MANAGER_FIELDS) {
    const value = existing[key]
    if (value !== undefined && value !== null && value !== '') {
      ;(merged as any)[key] = value
    }
  }
  return merged
}
