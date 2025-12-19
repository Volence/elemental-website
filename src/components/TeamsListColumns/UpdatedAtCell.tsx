'use client'

import React, { useState, useEffect } from 'react'

/**
 * Custom cell component to display updated at timestamp with vertical centering
 * Uses client-side only rendering to avoid hydration issues with timezones
 */
const UpdatedAtCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const updatedAt = rowData?.updatedAt
  const [formattedDate, setFormattedDate] = useState<string>('-')
  
  useEffect(() => {
    if (!updatedAt) {
      setFormattedDate('-')
      return
    }
    
    try {
      const date = new Date(updatedAt)
      const formatted = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date)
      setFormattedDate(formatted)
    } catch {
      setFormattedDate(updatedAt)
    }
  }, [updatedAt])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      {formattedDate}
    </div>
  )
}

export default UpdatedAtCell
