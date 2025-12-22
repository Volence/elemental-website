import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

/**
 * Admin Authentication Utilities
 * 
 * Provides type-safe hooks for accessing user information and checking permissions
 * in admin panel components.
 */

/**
 * Get the current authenticated user with proper typing.
 * Returns undefined if not authenticated.
 * 
 * Use this instead of manually casting `user as User` everywhere.
 */
export function useAdminUser(): User | undefined {
  const { user } = useAuth()
  // @ts-ignore - Payload ClientUser type compatibility issue
  return user as User | undefined
}

/**
 * Check if the current user has the ADMIN role.
 * Returns false if not authenticated.
 */
export function useIsAdmin(): boolean {
  const user = useAdminUser()
  return user?.role === UserRole.ADMIN
}

/**
 * Check if the current user has the TEAM_MANAGER role.
 * Returns false if not authenticated.
 */
export function useIsTeamManager(): boolean {
  const user = useAdminUser()
  return user?.role === UserRole.TEAM_MANAGER
}

/**
 * Check if the current user has the STAFF_MANAGER role.
 * Returns false if not authenticated.
 */
export function useIsStaffManager(): boolean {
  const user = useAdminUser()
  return user?.role === UserRole.STAFF_MANAGER
}

/**
 * Check if the current user can manage teams (Admin, Team Manager, or Staff Manager).
 * Returns false if not authenticated.
 */
export function useCanManageTeams(): boolean {
  const user = useAdminUser()
  return (
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.TEAM_MANAGER ||
    user?.role === UserRole.STAFF_MANAGER
  )
}

/**
 * Get a human-readable label for a user role.
 */
export function getRoleLabel(role: UserRole | undefined): string {
  if (!role) return 'Unknown'
  
  const roleLabels: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Administrator',
    [UserRole.TEAM_MANAGER]: 'Team Manager',
    [UserRole.STAFF_MANAGER]: 'Staff Manager',
  }
  
  return roleLabels[role] || role
}

