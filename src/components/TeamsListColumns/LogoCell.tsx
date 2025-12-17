'use client'

import React, { useState, useEffect } from 'react'

/**
 * Custom cell component to display team logo thumbnail in Teams list view
 */
const LogoCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const logoPath = rowData?.logo
  const orgLogoPath = '/logos/org.png'
  
  // Determine initial source
  const getInitialSrc = () => {
    if (logoPath && typeof logoPath === 'string' && logoPath.trim() !== '') {
      return logoPath
    }
    return orgLogoPath
  }
  
  const [imgSrc, setImgSrc] = useState(getInitialSrc())
  const [hasError, setHasError] = useState(false)

  // Update image source if logo path changes
  useEffect(() => {
    setImgSrc(getInitialSrc())
    setHasError(false)
  }, [logoPath])

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
          src={imgSrc}
          alt={rowData?.name || 'Team logo'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
          onError={(e) => {
            // If image fails to load, fallback to org logo (only once)
            if (!hasError && imgSrc !== orgLogoPath) {
              setImgSrc(orgLogoPath)
              setHasError(true)
            }
          }}
        />
      </div>
    </div>
  )
}

export default LogoCell
