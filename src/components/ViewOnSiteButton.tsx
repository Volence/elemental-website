'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

/**
 * Button component that links to the live frontend page for a document
 * Used in Teams, Matches, and People collections
 */
const ViewOnSiteButton: React.FC<{ basePath: string }> = ({ basePath }) => {
  const { id } = useDocumentInfo()
  const [slug, setSlug] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // Fetch the document to get the slug
    const fetchSlug = async () => {
      try {
        // Get the current document's slug from the form data
        const formElement = document.querySelector('form')
        if (formElement) {
          const slugInput = formElement.querySelector<HTMLInputElement>('input[name="slug"]')
          if (slugInput && slugInput.value) {
            setSlug(slugInput.value)
            setLoading(false)
            return
          }
        }
        setLoading(false)
      } catch (error) {
        console.error('Error fetching slug:', error)
        setLoading(false)
      }
    }

    if (id) {
      fetchSlug()
    }
  }, [id])

  if (loading || !slug) {
    return null
  }

  const liveUrl = `https://elmt.gg${basePath}/${slug}`

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <a
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          background: 'linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(22, 163, 74) 100%)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: 600,
          border: '1px solid rgba(34, 197, 94, 0.5)',
          boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 0 30px rgba(34, 197, 94, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.3)'
        }}
      >
        <span style={{ fontSize: '1rem' }}>🌐</span>
        <span>View on Live Site</span>
        <span>→</span>
      </a>
    </div>
  )
}

export default ViewOnSiteButton

