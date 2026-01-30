'use client'

import React, { useEffect, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

interface FileData {
  url?: string
  filename?: string
}

/**
 * Component that displays a live preview of the team logo
 * Shows next to the logo field in the Teams edit form
 */
const TeamLogoPreview: React.FC = () => {
  const [fileData, setFileData] = useState<FileData | null>(null)
  const [loading, setLoading] = useState(false)

  const logoField = useFormFields(([fields]) => {
    const logoValue = fields?.logo?.value
    return logoValue
  })

  // Fetch file data when we have an ID
  useEffect(() => {
    const fetchFileData = async (id: number) => {
      setLoading(true)
      try {
        const response = await fetch(`/api/graphics-assets/${id}?depth=0`)
        if (response.ok) {
          const data = await response.json()
          setFileData({
            url: data.url,
            filename: data.filename,
          })
        }
      } catch (error) {
        console.error('[TeamLogoPreview] Error fetching file:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!logoField) {
      setFileData(null)
      return
    }

    // If it's a number (ID), fetch the document
    if (typeof logoField === 'number') {
      fetchFileData(logoField)
      return
    }

    // If it's a string (ID as string), parse and fetch
    if (typeof logoField === 'string' && !isNaN(Number(logoField))) {
      fetchFileData(Number(logoField))
      return
    }

    // If it's already an object with url
    if (typeof logoField === 'object' && logoField !== null && 'url' in logoField) {
      setFileData({
        url: (logoField as any).url,
        filename: (logoField as any).filename,
      })
    }
  }, [logoField])

  return (
    <div className="team-logo-preview">
      <div className="team-logo-preview__label">
        Logo Preview
      </div>
      {loading ? (
        <div className="team-logo-preview__container team-logo-preview__container--empty">
          Loading...
        </div>
      ) : !fileData?.url ? (
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
          No logo selected
        </div>
      ) : (
        <div className="team-logo-preview__container team-logo-preview__container--filled">
          <div className="team-logo-preview__image-wrapper">
            <img
              src={fileData.url}
              alt="Team logo preview"
              className="team-logo-preview__image"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = `
                    <div class="team-logo-preview__error">
                      ⚠️ Logo failed to load
                    </div>
                  `
                }
              }}
            />
          </div>
          {fileData.filename && (
            <div className="team-logo-preview__path">
              {fileData.filename}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TeamLogoPreview

