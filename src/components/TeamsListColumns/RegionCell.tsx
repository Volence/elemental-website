'use client'

import React from 'react'

/**
 * Custom cell component to display team region with vertical centering
 */
const RegionCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const regionLabels: Record<string, string> = {
    NA: 'North America',
    EU: 'Europe',
    SA: 'South America',
    Other: 'Other',
  }

  const region = rowData?.region
  const displayText = region ? regionLabels[region] || region : '-'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      {displayText}
    </div>
  )
}

export default RegionCell
