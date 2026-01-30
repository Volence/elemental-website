'use client'

import React, { useEffect, useState } from 'react'
import { getLogoUrl } from '@/utilities/getLogoUrl'

/**
 * Compute initial logo URL synchronously (no flash)
 */
function getInitialLogoUrl(rowData: any): string {
  const cachedFilename = rowData?.logoFilename
  const logo = rowData?.logo
  
  // Priority 1: Use cached logoFilename (instant)
  if (cachedFilename) {
    return `/graphics-assets/${cachedFilename}`
  }
  
  // Priority 2: Handle various logo formats
  if (!logo) {
    return '/logos/org.png'
  }
  
  if (typeof logo === 'string') {
    return logo
  }
  
  if (typeof logo === 'object' && logo !== null) {
    return getLogoUrl(logo)
  }
  
  // If logo is just an ID (number), return fallback - will be fetched async
  return '/logos/org.png'
}

/**
 * Custom cell component to display team logo thumbnail in Teams list view
 * Handles both populated relationship objects and unpopulated IDs
 */
const LogoCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  // Compute initial URL synchronously to avoid flash
  const initialUrl = getInitialLogoUrl(rowData)
  const [logoUrl, setLogoUrl] = useState(initialUrl)

  // Only fetch async if logo is an ID without cached filename
  useEffect(() => {
    const logo = rowData?.logo
    const cachedFilename = rowData?.logoFilename
    
    // If we have a cached filename or non-ID logo, we already have the URL
    if (cachedFilename || !logo || typeof logo !== 'number') {
      return
    }

    // Fetch the asset for ID-only case
    fetch(`/api/graphics-assets/${logo}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(asset => {
        if (asset?.filename) {
          setLogoUrl(`/graphics-assets/${asset.filename}`)
        } else if (asset?.url) {
          setLogoUrl(asset.url)
        }
      })
      .catch(() => {
        // Keep fallback
      })
  }, [rowData?.logo, rowData?.logoFilename])

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
          src={logoUrl}
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


