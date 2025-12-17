import type { AccessArgs } from 'payload'

import type { OrganizationStaff, Production, User } from '@/payload-types'
import { UserRole, isAdmin } from './roles'

/**
 * Check if user can access organization staff
 * - Admins can access all staff
 * - Staff managers can access all organization staff
 */
export const canAccessOrgStaff = async ({ req, id }: AccessArgs<User> & { id?: number | string }): Promise<boolean> => {
  const user = req.user as User | undefined
  if (!user) return false

  // Admins can access everything
  if (isAdmin({ req })) return true

  // Staff managers can access all organization staff
  if (user.role === UserRole.STAFF_MANAGER) {
    return true
  }

  return false
}

/**
 * Check if user can access production staff
 * - Admins can access all production staff
 * - Staff managers can access all production staff
 */
export const canAccessProductionStaff = async ({ req, id }: AccessArgs<User> & { id?: number | string }): Promise<boolean> => {
  const user = req.user as User | undefined
  if (!user) return false

  // Admins can access everything
  if (isAdmin({ req })) return true

  // Staff managers can access all production staff
  if (user.role === UserRole.STAFF_MANAGER) {
    return true
  }

  return false
}

/**
 * Check if user can create organization staff
 * Only admins and staff managers can create
 */
export const canCreateOrgStaff = ({ req }: AccessArgs<User>): boolean => {
  const user = req.user as User | undefined
  if (!user) return false
  return isAdmin({ req }) || user.role === UserRole.STAFF_MANAGER
}

/**
 * Check if user can create production staff
 * Only admins and staff managers can create
 */
export const canCreateProductionStaff = ({ req }: AccessArgs<User>): boolean => {
  const user = req.user as User | undefined
  if (!user) return false
  return isAdmin({ req }) || user.role === UserRole.STAFF_MANAGER
}
