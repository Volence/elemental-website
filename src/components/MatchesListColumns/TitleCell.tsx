'use client'

import React from 'react'

/**
 * Custom cell component to display match title with auto-generation fallback
 */
const MatchTitleCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  let title = rowData?.title || ''
  
  // If title is empty, generate one from team + opponent
  if (!title || title.trim() === '') {
    const teamName = rowData?.team?.name || ''
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
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      {title}
    </div>
  )
}

export default MatchTitleCell
