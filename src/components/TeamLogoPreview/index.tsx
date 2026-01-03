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
    <div className="team-logo-preview">
      <div className="team-logo-preview__label">
        Logo Preview
      </div>
      {!logoPath || typeof logoPath !== 'string' || logoPath.trim() === '' ? (
        <div className="team-logo-preview__container team-logo-preview__container--empty">
          <div className="team-logo-preview__empty-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
        <div className="team-logo-preview__container team-logo-preview__container--filled">
          <div className="team-logo-preview__image-wrapper">
            <img
              src={logoPath}
              alt="Team logo preview"
              className="team-logo-preview__image"
              onError={(e) => {
                // If image fails to load, show error message
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = `
                    <div class="team-logo-preview__error">
                      ⚠️ Logo not found at this path
                    </div>
                  `
                }
              }}
            />
          </div>
          <div className="team-logo-preview__path">
            {logoPath}
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamLogoPreview




