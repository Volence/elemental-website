'use client'

import React from 'react'

/**
 * Custom cell component to display team name with vertical centering
 */
const NameCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      {rowData?.name || 'Untitled'}
    </div>
  )
}

export default NameCell
