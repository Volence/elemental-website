'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

/**
 * Component that displays a live preview of the team logo
 * Shows next to the logo path field in the Teams edit form
 */
const TeamLogoPreview: React.FC = () => {
  const logoPath = useFormFields(([fields]) => {
    return fields?.logo?.value as string | undefined
  })

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--theme-text)',
          marginBottom: '0.5rem',
        }}
      >
        Logo Preview
      </div>
      {!logoPath || typeof logoPath !== 'string' || logoPath.trim() === '' ? (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--theme-elevation-100)',
            border: '1px dashed var(--theme-elevation-400)',
            borderRadius: '8px',
            textAlign: 'center',
            color: 'var(--theme-text-500)',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ marginBottom: '0.5rem' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ opacity: 0.3, margin: '0 auto' }}
            >
              <path
                d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                fill="currentColor"
              />
            </svg>
          </div>
          No logo set
        </div>
      ) : (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--theme-elevation-50)',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
            }}
          >
            <img
              src={logoPath}
              alt="Team logo preview"
              style={{
                maxWidth: '100%',
                maxHeight: '120px',
                objectFit: 'contain',
                borderRadius: '4px',
              }}
              onError={(e) => {
                // If image fails to load, show error message
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = `
                    <div style="color: var(--theme-error-500); font-size: 0.875rem;">
                      ⚠️ Logo not found at this path
                    </div>
                  `
                }
              }}
            />
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--theme-text-500)',
              wordBreak: 'break-all',
            }}
          >
            {logoPath}
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamLogoPreview



