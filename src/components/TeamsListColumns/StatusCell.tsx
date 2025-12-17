'use client'

import React from 'react'

/**
 * Custom cell component to display team active status in Teams list view
 */
const StatusCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const isActive = rowData?.active !== false // Default to active if not set

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '50px',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          backgroundColor: isActive
            ? 'var(--theme-success-100)'
            : 'var(--theme-elevation-200)',
          color: isActive ? 'var(--theme-success-700)' : 'var(--theme-text-500)',
          border: `1px solid ${isActive ? 'var(--theme-success-300)' : 'var(--theme-elevation-400)'}`,
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isActive ? 'var(--theme-success-500)' : 'var(--theme-text-400)',
          }}
        />
        {isActive ? 'Active' : 'Inactive'}
      </div>
    </div>
  )
}

export default StatusCell
