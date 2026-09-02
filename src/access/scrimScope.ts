/**
 * Auth helpers for API routes to read the current user's role and team scope.
 * Used for data scoping - players and team managers only see their teams' data.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { UserRole } from '@/access/roles'
import type { Person, Team } from '@/payload-types'
import { scrimOwnerKey } from '@/lib/scrim-analytics/ownerKey'

export type UserScope = {
  role: UserRole
  userId: number
  email: string
  /** How this user's uploads are keyed in scrim_scrims.creatorEmail (null when neither an
   * email nor a Discord ID is on the account). Always compare against this, not `email`. */
  ownerKey: string | null
  assignedTeamIds: number[]
  linkedPersonId: number | null
  isFullAccess: boolean // admin or staff-manager - no scoping
  /** departments.canUploadExternalScrims - may upload/view external-team scrims they created */
  canUploadExternalScrims: boolean
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

    const role = (user.role as UserRole) ?? UserRole.USER
    const isFullAccess = role === UserRole.ADMIN || role === UserRole.STAFF_MANAGER

    // Resolve assigned team IDs (may be populated objects or plain IDs)
    const assignedTeamIds: number[] = []
    if (user.assignedTeams && Array.isArray(user.assignedTeams)) {
      for (const t of user.assignedTeams) {
        if (typeof t === 'number') {
          assignedTeamIds.push(t)
        } else if (t && typeof t === 'object' && 'id' in t) {
          assignedTeamIds.push((t as Team).id)
        }
      }
    }

    const linkedPersonId: number = user.id

    const departments = (user as { departments?: { canUploadExternalScrims?: boolean | null } | null }).departments

    return {
      role,
      userId: user.id,
      email: user.email ?? '',
      ownerKey: scrimOwnerKey(user as { email?: string | null; discordId?: string | null }),
      assignedTeamIds,
      linkedPersonId,
      isFullAccess,
      canUploadExternalScrims: departments?.canUploadExternalScrims === true,
    }
  } catch {
    return null
  }
}

/**
 * Check if the user is a scrim viewer (can access scrim analytics pages).
 */
export function isScrimViewerRole(role: UserRole): boolean {
  return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER, UserRole.PLAYER].includes(role)
}

/**
 * Check if the user can upload scrims (admin, staff-manager, or team-manager).
 */
export function canUploadScrims(role: UserRole): boolean {
  return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(role)
}

/**
 * Whether a user may view the scrim analytics pages: the standard scrim
 * roles, plus flagged external-scrim coaches (whatever their role).
 * Takes the raw Payload user doc so server components can call it directly.
 */
export function hasScrimAccess(
  user:
    | { role?: string | null; departments?: { canUploadExternalScrims?: boolean | null } | null }
    | null
    | undefined,
): boolean {
  if (!user?.role) return false
  if (['admin', 'staff-manager', 'team-manager', 'player'].includes(user.role)) return true
  return user.departments?.canUploadExternalScrims === true
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
