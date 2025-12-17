'use client'

import React from 'react'

/**
 * Custom cell component to display updated at timestamp with vertical centering
 */
const UpdatedAtCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const updatedAt = rowData?.updatedAt
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date)
    } catch {
      return dateString
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
      {formatDate(updatedAt)}
    </div>
  )
}

export default UpdatedAtCell
