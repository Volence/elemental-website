'use client'

import React from 'react'

/**
 * Custom cell component to display team rating with vertical centering
 */
const RatingCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      {rowData?.rating || '-'}
    </div>
  )
}

export default RatingCell
