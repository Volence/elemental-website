'use client'

import React from 'react'
import { titlesOf } from '@/utilities/staffFromTitles'

/**
 * Custom cell component that displays all staff titles a person holds.
 * Shows in the People list view. Titles are already on the row - no fetch needed.
 */
const StaffPositionsCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const positions = titlesOf(rowData ?? {}).map((t) => t.label)

  if (positions.length === 0) {
    return <span className="list-cell-empty">-</span>
  }

  return (
    <div className="list-cell-tags">
      {positions.map((position, idx) => (
        <span key={idx} className="list-cell-tag list-cell-tag--position">
          {position}
        </span>
      ))}
    </div>
  )
}

export default StaffPositionsCell
