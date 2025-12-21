'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useIsAdmin, useIsTeamManager, useIsStaffManager, useCanManageTeams } from '@/utilities/adminAuth'

/**
 * Component that displays helpful information for Team/Staff Managers on the Teams page
 */
const TeamManagerInfo: React.FC = () => {
  const pathname = usePathname()
  const canManageTeams = useCanManageTeams()
  const isAdmin = useIsAdmin()
  const isTeamManager = useIsTeamManager()
  const isStaffManager = useIsStaffManager()
  
  // Only show for users who can manage teams on Teams page
  if (!canManageTeams || !pathname?.includes('/teams')) {
    return null
  }
  
  // Determine variant class
  const variant = isAdmin ? 'admin' : isTeamManager ? 'team-manager' : 'staff-manager'
  
  return (
    <div className={`team-manager-info team-manager-info--${variant}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, marginTop: '0.125rem' }}
        >
          <path
            d="M9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5ZM8.25 12.75L5.25 9.75L6.3075 8.6925L8.25 10.6275L11.6925 7.185L12.75 8.25L8.25 12.75Z"
            fill="var(--theme-success-500)"
          />
        </svg>
        <div style={{ flex: 1 }}>
          {isAdmin && (
            <>
              <strong className="team-manager-info__title">
                Admin Quick Access
              </strong>
              <div className="team-manager-info__description">
                Your <strong>assigned teams</strong> are shown above for quick access. 
                As an Admin, you can edit all teams, but these are the teams you primarily work with.
              </div>
            </>
          )}
          {isTeamManager && (
            <>
              <strong className="team-manager-info__title">
                Team Manager Access
              </strong>
              <div className="team-manager-info__description">
                You can <strong>create new teams</strong> and <strong>edit your assigned teams</strong> (shown above). 
                Other teams are visible but read-only. Click on your assigned teams above to edit them directly.
              </div>
            </>
          )}
          {isStaffManager && (
            <>
              <strong className="team-manager-info__title">
                Staff Manager Quick Access
              </strong>
              <div className="team-manager-info__description">
                Your <strong>assigned teams</strong> are shown above for quick access. 
                As a Staff Manager, you can edit all teams, but these are the teams you primarily work with.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TeamManagerInfo
