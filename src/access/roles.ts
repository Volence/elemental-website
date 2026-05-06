import type { AccessArgs } from 'payload'

import type { Person } from '@/payload-types'

export enum UserRole {
  ADMIN = 'admin',
  TEAM_MANAGER = 'team-manager',
  STAFF_MANAGER = 'staff-manager',
  PLAYER = 'player',
  USER = 'user',
}

type AccessCheck = (args: AccessArgs<Person>) => boolean | Promise<boolean>

/**
 * Check if user has admin role
 */
export const isAdmin = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  return (user as Person).role === UserRole.ADMIN
}

/**
 * Check if user has a specific role
 */
export const hasRole = (role: UserRole) => ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  return (user as Person).role === role
}

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (...roles: UserRole[]) => ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  return roles.includes((user as Person).role as UserRole)
}

/**
 * Admin can do everything, others can only read
 */
export const adminOrReadOnly: AccessCheck = ({ req: { user } }) => {
  if (!user) return false
  return (user as Person).role === UserRole.ADMIN
}

/**
 * Admin can do everything, authenticated users can read
 */
export const adminOrAuthenticated: AccessCheck = ({ req: { user } }) => {
  if (!user) return false
  return true // All authenticated users can read
}

/**
 * Only admins can create/update/delete
 */
export const adminOnly: AccessCheck = ({ req: { user } }) => {
  if (!user) return false
  return (user as Person).role === UserRole.ADMIN
}

/**
 * Check if user has production staff access
 */
export const isProductionStaff = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const u = user as Person
  return u.departments?.isProductionStaff === true || 
         u.role === UserRole.ADMIN ||
         u.role === UserRole.STAFF_MANAGER
}

/**
 * Check if user is production manager (admin or staff-manager)
 * Used to restrict full access to production-related collections
 */
export const isProductionManager = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  return (user as Person).role === UserRole.ADMIN ||
         (user as Person).role === UserRole.STAFF_MANAGER
}

/**
 * Check if user has social media staff access
 */
export const isSocialMediaStaff = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const u = user as Person
  return u.departments?.isSocialMediaStaff === true || 
         u.role === UserRole.ADMIN ||
         u.role === UserRole.STAFF_MANAGER
}

/**
 * Check if user has graphics staff access
 */
export const isGraphicsStaff = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const u = user as Person
  return u.departments?.isGraphicsStaff === true || 
         u.role === UserRole.ADMIN ||
         u.role === UserRole.STAFF_MANAGER
}

/**
 * Check if user has video editing staff access
 */
export const isVideoStaff = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const u = user as Person
  return u.departments?.isVideoStaff === true || 
         u.role === UserRole.ADMIN ||
         u.role === UserRole.STAFF_MANAGER
}

/**
 * Check if user has events staff access
 */
export const isEventsStaff = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const u = user as Person
  return u.departments?.isEventsStaff === true || 
         u.role === UserRole.ADMIN ||
         u.role === UserRole.STAFF_MANAGER
}

/**
 * Check if user has scouting staff access
 */
export const isScoutingStaff = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const u = user as Person
  return u.departments?.isScoutingStaff === true || 
         u.role === UserRole.ADMIN ||
         u.role === UserRole.STAFF_MANAGER
}

/**
 * Check if user can view scrim analytics (admin, staff-manager, team-manager, or player)
 */
export const isScrimViewer = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const role = (user as Person).role as UserRole
  return (
    role === UserRole.ADMIN ||
    role === UserRole.STAFF_MANAGER ||
    role === UserRole.TEAM_MANAGER ||
    role === UserRole.PLAYER
  )
}

/**
 * Check if user has PUG admin access
 */
export const isPugAdmin = ({ req: { user } }: AccessArgs<Person>): boolean => {
  if (!user) return false
  const u = user as Person
  return u.departments?.isPugAdmin === true || u.role === UserRole.ADMIN
}

/**
 * Helper for admin.hidden - hides collections from player/user roles in sidebar.
 * Use as: admin: { hidden: hideFromPlayers }
 * This only affects sidebar visibility, not API access.
 * Uses 'any' for user type since Payload's admin.hidden provides ClientUser, not full User.
 */
export const hideFromPlayers = ({ user }: { user: any }): boolean => {
  if (!user) return false
  const role = user.role as UserRole
  return role === UserRole.PLAYER || role === UserRole.USER
}

