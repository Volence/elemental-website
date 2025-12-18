'use client'

import React from 'react'
import Link from 'next/link'

/**
 * Custom cell component to display match title with auto-generation fallback
 */
const MatchTitleCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  let title = rowData?.title || ''
  
  // If title is empty, generate one from team + opponent
  if (!title || title.trim() === '') {
    // Access team name from the populated relationship
    const teamName = rowData?.team?.value?.name || rowData?.team?.name || ''
    const opponent = rowData?.opponent || 'TBD'
    
    if (teamName && opponent !== 'TBD') {
      title = `ELMT ${teamName} vs ${opponent}`
    } else if (teamName) {
      title = `ELMT ${teamName} vs TBD`
    } else if (opponent !== 'TBD') {
      title = `ELMT vs ${opponent}`
    } else {
      title = 'ELMT Match'
    }
  }
  
  const matchId = rowData?.id
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      {matchId ? (
        <Link
          href={`/admin/collections/matches/${matchId}`}
          style={{
            color: 'var(--theme-text)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
          className="match-title-link"
        >
          {title}
        </Link>
      ) : (
        <span>{title}</span>
      )}
      <style jsx global>{`
        .match-title-link:hover {
          color: var(--theme-elevation-900);
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default MatchTitleCell
