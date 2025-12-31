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
    <div className="view-on-site">
      <a
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="view-on-site__link"
      >
        <span className="view-on-site__icon">🌐</span>
        <span>View on Live Site</span>
        <span>→</span>
      </a>
    </div>
  )
}

export default ViewOnSiteButton

