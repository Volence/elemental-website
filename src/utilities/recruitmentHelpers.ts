import type { User, RecruitmentListing, Team } from '@/payload-types'
import { UserRole } from '@/access/roles'

/**
 * Check if a user can manage (edit/update) a recruitment listing
 */
export const canManageListing = (user: User | null | undefined, listing: RecruitmentListing): boolean => {
  if (!user) return false

  // Admins can manage everything
  if (user.role === UserRole.ADMIN) return true

  // Staff managers can manage everything
  if (user.role === UserRole.STAFF_MANAGER) return true

  // Creator can manage their own listings
  const createdById = typeof listing.createdBy === 'number' 
    ? listing.createdBy 
    : listing.createdBy?.id

  if (createdById === user.id) return true

  // Team managers can manage listings for their assigned teams
  if (user.role === UserRole.TEAM_MANAGER) {
    const assignedTeams = user.assignedTeams
    if (!assignedTeams || !Array.isArray(assignedTeams)) return false

    const teamIds = assignedTeams.map((team: any) =>
      typeof team === 'number' ? team : team?.id || team,
    )

    const listingTeamId = typeof listing.team === 'number' 
      ? listing.team 
      : (listing.team as Team)?.id

    return teamIds.includes(Number(listingTeamId))
  }

  return false
}

/**
 * Check if a user can view applications for a team
 */
export const canViewApplications = (user: User | null | undefined, teamId: number): boolean => {
  if (!user) return false

  // Admins can view everything
  if (user.role === UserRole.ADMIN) return true

  // Staff managers can view everything
  if (user.role === UserRole.STAFF_MANAGER) return true

  // Team managers can view applications for their assigned teams
  if (user.role === UserRole.TEAM_MANAGER) {
    const assignedTeams = user.assignedTeams
    if (!assignedTeams || !Array.isArray(assignedTeams)) return false

    const teamIds = assignedTeams.map((team: any) =>
      typeof team === 'number' ? team : team?.id || team,
    )

    return teamIds.includes(teamId)
  }

  return false
}

/**
 * Check if a listing is currently accepting applications
 */
export const isListingOpen = (listing: RecruitmentListing): boolean => {
  return listing.status === 'open'
}

