'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useCanManageTeams } from '@/utilities/adminAuth'
import { useAssignedTeams } from '@/utilities/adminHooks'

/**
 * Component that displays assigned teams at the top of the Teams list page
 * Only shows for Team Managers to highlight which teams they can edit
 */
const AssignedTeamsBanner: React.FC = () => {
  const pathname = usePathname()
  const canManageTeams = useCanManageTeams()
  const { teams: assignedTeams, loading } = useAssignedTeams()
  
  // Only show for users who can manage teams on the Teams page
  if (!canManageTeams) return null
  if (!pathname?.includes('/teams')) return null
  if (loading) return null
  if (assignedTeams.length === 0) return null
  
  return (
    <div className="assigned-teams-banner">
      <strong className="assigned-teams-banner__title">
        Your Assigned Teams:
      </strong>
      {assignedTeams.map((team) => (
        <a
          key={team.id}
          href={`/admin/collections/teams/${team.id}`}
          className="assigned-teams-banner__team-link"
        >
          <div className="assigned-teams-banner__team-logo-wrapper">
            <img
              src={team.logo || '/logos/org.png'}
              alt={`${team.name} logo`}
              className="assigned-teams-banner__team-logo"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (target.src !== '/logos/org.png') {
                  target.src = '/logos/org.png'
                }
              }}
            />
          </div>
          {team.name}
        </a>
      ))}
    </div>
  )
}

export default AssignedTeamsBanner
