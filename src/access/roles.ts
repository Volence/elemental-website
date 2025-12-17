import type { AccessArgs } from 'payload'

import type { User } from '@/payload-types'

export enum UserRole {
  ADMIN = 'admin',
  TEAM_MANAGER = 'team-manager',
  STAFF_MANAGER = 'staff-manager',
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
