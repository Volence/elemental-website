import type { AccessArgs } from 'payload'

import type { User } from '@/payload-types'

export enum UserRole {
  ADMIN = 'admin',
  TEAM_MANAGER = 'team-manager',
  STAFF_MANAGER = 'staff-manager',
  USER = 'user',
}

type AccessCheck = (args: AccessArgs<User>) => boolean | Promise<boolean>

/**
 * Check if user has admin role
 */
export const isAdmin = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  return (user as User).role === UserRole.ADMIN
}

/**
 * Check if user has a specific role
 */
export const hasRole = (role: UserRole) => ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  return (user as User).role === role
}

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (...roles: UserRole[]) => ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  return roles.includes((user as User).role as UserRole)
}

/**
 * Admin can do everything, others can only read
 */
export const adminOrReadOnly: AccessCheck = ({ req: { user } }) => {
  if (!user) return false
  return (user as User).role === UserRole.ADMIN
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
  return (user as User).role === UserRole.ADMIN
}

/**
 * Check if user has production staff access
 */
export const isProductionStaff = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  const u = user as any
  return u.departments?.isProductionStaff === true || 
         (user as User).role === UserRole.ADMIN ||
         (user as User).role === UserRole.STAFF_MANAGER
}

/**
 * Check if user is production manager (admin or staff-manager)
 * Used to restrict full access to production-related collections
 */
export const isProductionManager = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  return (user as User).role === UserRole.ADMIN ||
         (user as User).role === UserRole.STAFF_MANAGER
}

/**
 * Check if user has social media staff access
 */
export const isSocialMediaStaff = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  const u = user as any
  return u.departments?.isSocialMediaStaff === true || 
         (user as User).role === UserRole.ADMIN ||
         (user as User).role === UserRole.STAFF_MANAGER
}
