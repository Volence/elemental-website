'use client'

import React from 'react'

/**
 * Custom cell component to display team logo thumbnail in Teams list view
 */
const LogoCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const logoPath = rowData?.logo

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
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: 'var(--theme-elevation-100)',
          border: '1px solid var(--theme-elevation-300)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={logoPath}
          alt={rowData?.name || 'Team logo'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  )
}

export default LogoCell
