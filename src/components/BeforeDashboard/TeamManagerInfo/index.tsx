'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

/**
 * Component that displays helpful information for Team/Staff Managers on the Teams page
 */
const TeamManagerInfo: React.FC = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  
  if (!user) return null
  
  // @ts-ignore - Payload ClientUser type compatibility issue
  const currentUser = user as User
  
  // Only show for Admins, Team Managers, and Staff Managers on Teams page
  const canShow = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_MANAGER || currentUser.role === UserRole.STAFF_MANAGER
  if (!canShow || !pathname?.includes('/teams')) {
    return null
  }
  
  // Different messages based on role
  const isAdmin = currentUser.role === UserRole.ADMIN
  const isTeamManager = currentUser.role === UserRole.TEAM_MANAGER
  const isStaffManager = currentUser.role === UserRole.STAFF_MANAGER
  
  return (
    <div
      style={{
        marginBottom: '1rem',
        padding: '0.875rem 1rem',
        backgroundColor: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: '6px',
        fontSize: '0.875rem',
        color: 'var(--theme-text-600)',
      }}
    >
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
              <strong style={{ color: 'var(--theme-text)', display: 'block', marginBottom: '0.25rem' }}>
                Admin Quick Access
              </strong>
              <div style={{ lineHeight: '1.5' }}>
                Your <strong>assigned teams</strong> are shown above for quick access. 
                As an Admin, you can edit all teams, but these are the teams you primarily work with.
              </div>
            </>
          )}
          {isTeamManager && (
            <>
              <strong style={{ color: 'var(--theme-text)', display: 'block', marginBottom: '0.25rem' }}>
                Team Manager Access
              </strong>
              <div style={{ lineHeight: '1.5' }}>
                You can <strong>create new teams</strong> and <strong>edit your assigned teams</strong> (shown above). 
                Other teams are visible but read-only. Click on your assigned teams above to edit them directly.
              </div>
            </>
          )}
          {isStaffManager && (
            <>
              <strong style={{ color: 'var(--theme-text)', display: 'block', marginBottom: '0.25rem' }}>
                Staff Manager Quick Access
              </strong>
              <div style={{ lineHeight: '1.5' }}>
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
