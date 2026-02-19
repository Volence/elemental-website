/**
 * Auth helpers for API routes to read the current user's role and team scope.
 * Used for data scoping — players and team managers only see their teams' data.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { UserRole } from '@/access/roles'
import type { User, Team } from '@/payload-types'

export type UserScope = {
  role: UserRole
  userId: number
  assignedTeamIds: number[]
  linkedPersonId: number | null
  isFullAccess: boolean // admin or staff-manager — no scoping
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
    const user = result.user as User | null

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

    // Resolve linked person ID
    let linkedPersonId: number | null = null
    if (user.linkedPerson) {
      if (typeof user.linkedPerson === 'number') {
        linkedPersonId = user.linkedPerson
      } else if (typeof user.linkedPerson === 'object' && 'id' in user.linkedPerson) {
        linkedPersonId = user.linkedPerson.id
      }
    }

    return {
      role,
      userId: user.id,
      assignedTeamIds,
      linkedPersonId,
      isFullAccess,
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
