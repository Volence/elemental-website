'use client'

import React from 'react'
import Link from 'next/link'

/**
 * Custom cell component to display team name with vertical centering and link to edit page
 */
const NameCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const teamId = rowData?.id
  const teamName = rowData?.name || 'Untitled'
  
  if (!teamId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: '50px',
        }}
      >
        {teamName}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      <Link
        href={`/admin/collections/teams/${teamId}`}
        style={{
          color: 'var(--theme-text)',
          textDecoration: 'none',
          fontWeight: 500,
        }}
        className="team-name-link"
      >
        {teamName}
      </Link>
      <style jsx global>{`
        .team-name-link:hover {
          color: var(--theme-elevation-900);
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default NameCell
