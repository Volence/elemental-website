/**
 * Auth helpers for API routes to read the current user's resolved access and team scope.
 * Used for data scoping - players and team-access people only see their teams' data.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { resolveAccessForUser } from '@/access'
import type { Person } from '@/payload-types'
import { scrimOwnerKey } from '@/lib/scrim-analytics/ownerKey'

// Single definition lives in resolve.ts (pure, no next/headers) so client-reachable code
// (ScrimAnalyticsTabs/access.ts) can import it without dragging this file's next/headers
// dependency into a 'use client' bundle.
export { hasScrimAccess } from './resolve'

export type UserScope = {
  userId: number
  /** How this user's uploads are keyed in scrim_scrims.creatorEmail (null when neither an
   * email nor a Discord ID is on the account). Always compare against this, not an email. */
  ownerKey: string | null
  teamIds: number[]
  isFullAccess: boolean // admin or staff-manager - no scoping
  /** departments.canUploadExternalScrims - may upload/view external-team scrims they created */
  canUploadExternalScrims: boolean
  personId: number
}

/**
 * Get the current user's scope from the request.
 * Returns null if the user is not authenticated.
 */
export async function getUserScope(): Promise<UserScope | null> {
  try {
    const payload = await getPayload({ config })
    const hdrs = await nextHeaders()

    // Try to get the user from the Payload auth cookie
    const result = await payload.auth({ headers: hdrs })
    const user = result.user as Person | null

    if (!user) return null

    const access = await resolveAccessForUser(payload, user as never)
    if (!access) return null

    return {
      userId: user.id,
      ownerKey: scrimOwnerKey(user as { email?: string | null; discordId?: string | null }),
      teamIds: [...access.teamIds],
      isFullAccess: access.canManagePeople,
      canUploadExternalScrims: access.canUploadExternalScrims,
      personId: user.id,
    }
  } catch {
    return null
  }
}

/**
 * Prisma where-fragment for the external-team scrims this user may see:
 * full access sees all of them, flagged coaches see the ones they uploaded,
 * everyone else sees none (returns null).
 */
export function externalScrimWhere(scope: UserScope): Record<string, unknown> | null {
  if (scope.isFullAccess) return { externalTeamName: { not: null } }
  if (!scope.canUploadExternalScrims || !scope.ownerKey) return null
  return { externalTeamName: { not: null }, creatorEmail: scope.ownerKey }
}
