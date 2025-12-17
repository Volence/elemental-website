import type { AccessArgs } from 'payload'

import type { Team, User } from '@/payload-types'
import { UserRole, isAdmin } from './roles'

/**
 * Check if user can access a team
 * - Admins can access all teams
 * - Team managers can only access their assigned team
 */
export const canAccessTeam = async ({ req, id }: AccessArgs<User> & { id?: number | string }): Promise<boolean> => {
  const user = req.user as User | undefined
  if (!user) return false

  // Admins can access everything
  if (isAdmin({ req })) return true

  // Team managers can only access their assigned teams
  if (user.role === UserRole.TEAM_MANAGER) {
    if (!id) return false // Need team ID to check
    const assignedTeams = user.assignedTeams || []
    const teamIds = assignedTeams.map((team: any) => 
      typeof team === 'number' ? team : (team?.id || team)
    )
    return teamIds.includes(Number(id))
  }

  return false
}

/**
 * Check if user can create teams
 * Only admins can create teams
 */
export const canCreateTeam = ({ req }: AccessArgs<User>): boolean => {
  return isAdmin({ req })
}

/**
 * Check if user can update a team
 * - Admins can update all teams
 * - Team managers can only update their assigned team
 */
export const canUpdateTeam = async ({ req, id }: AccessArgs<User> & { id?: number | string }): Promise<boolean> => {
  return canAccessTeam({ req, id })
}

/**
 * Check if user can delete a team
 * Only admins can delete teams
 */
export const canDeleteTeam = ({ req }: AccessArgs<User>): boolean => {
  return isAdmin({ req })
}
