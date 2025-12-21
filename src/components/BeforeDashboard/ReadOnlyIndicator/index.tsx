'use client'

import React from 'react'
import { useAdminUser, useIsAdmin, useIsTeamManager, useIsStaffManager } from '@/utilities/adminAuth'

/**
 * Component to add visual indicators for read-only items in list views
 * This can be used as a cell component to show which items are editable
 */
export const ReadOnlyIndicator: React.FC<{ 
  rowData?: { id?: number | string; [key: string]: unknown }
  collection?: 'teams' | 'organization-staff' | 'production'
}> = ({ rowData, collection }) => {
  const user = useAdminUser()
  const isAdmin = useIsAdmin()
  const isTeamManager = useIsTeamManager()
  const isStaffManager = useIsStaffManager()
  
  if (!user || !rowData || !rowData.id) return null
  
  // Admins can edit everything
  if (isAdmin) return null
  
  let canEdit = false
  
  if (collection === 'teams' && isTeamManager) {
    // Check if this team is in the user's assignedTeams
    const assignedTeams = user.assignedTeams
    if (assignedTeams && Array.isArray(assignedTeams)) {
      const teamIds = assignedTeams.map((team: any) => 
        typeof team === 'number' ? team : (team?.id || team)
      )
      canEdit = teamIds.includes(Number(rowData.id))
    }
  } else if ((collection === 'organization-staff' || collection === 'production') && isStaffManager) {
    // Staff managers can edit all staff (both organization and production)
    canEdit = true
  }
  
  if (canEdit) return null
  
  // Show read-only indicator
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '0.75rem',
        color: 'var(--theme-text-50)',
        marginLeft: '0.5rem',
        opacity: 0.7,
      }}
      title="Read-only: You don't have permission to edit this item"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ marginRight: '0.25rem' }}
      >
        <path
          d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM7 11L4 8L5 7L7 9L11 5L12 6L7 11Z"
          fill="currentColor"
          fillOpacity="0.5"
        />
      </svg>
      Read-only
    </span>
  )
}
