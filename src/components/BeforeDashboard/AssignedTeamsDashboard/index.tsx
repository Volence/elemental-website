'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useCanManageTeams } from '@/utilities/adminAuth'
import { useAssignedTeams } from '@/utilities/adminHooks'

/**
 * Component that displays assigned teams on the dashboard page
 * Shows clickable team cards for Team Managers to quickly navigate to their teams
 */
const AssignedTeamsDashboard: React.FC = () => {
  const pathname = usePathname()
  const canManageTeams = useCanManageTeams()
  const { teams: assignedTeams, loading } = useAssignedTeams()
  
  // Only show for users who can manage teams on the dashboard page
  if (!canManageTeams) return null
  if (pathname !== '/admin' && pathname !== '/admin/') return null
  if (loading) return null
  if (assignedTeams.length === 0) return null
  
  return (
    <div style={{ 
      padding: '0.875rem 1rem',
      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(132, 204, 22, 0.05) 100%)',
      border: '2px solid rgba(6, 182, 212, 0.3)',
      borderRadius: '8px',
      marginBottom: '1.5rem'
    }}>
      <div className="assigned-teams-dashboard__header">
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="assigned-teams-dashboard__icon"
        >
          <path
            d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM9 13L5 9L6.41 7.59L9 10.17L13.59 5.58L15 7L9 13Z"
            fill="rgb(6, 182, 212)"
          />
        </svg>
        <h3 className="assigned-teams-dashboard__title">
          Your Assigned Teams
        </h3>
      </div>
      <div className="assigned-teams-dashboard__grid">
        {assignedTeams.map((team) => (
          <a
            key={team.id}
            href={`/admin/collections/teams/${team.id}`}
            className="assigned-teams-dashboard__card"
          >
            <div className="assigned-teams-dashboard__card-logo-wrapper">
              <img
                src={team.logo || '/logos/org.png'}
                alt={`${team.name} logo`}
                className="assigned-teams-dashboard__card-logo"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (target.src !== '/logos/org.png') {
                    target.src = '/logos/org.png'
                  }
                }}
              />
            </div>
            <span className="assigned-teams-dashboard__card-name">{team.name}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

export default AssignedTeamsDashboard
