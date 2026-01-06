'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast, useDocumentInfo } from '@payloadcms/ui'

/**
 * Consolidated match actions component
 * Combines View on Site and Delete buttons in a clean horizontal layout
 */
const MatchActions: React.FC = () => {
  const { id, title } = useDocumentInfo()
  const [isDeleting, setIsDeleting] = useState(false)
  const [slug, setSlug] = useState<string | null>(null)
  const router = useRouter()
  
  // Don't render if no ID (creating new match)
  useEffect(() => {
    if (id) {
      // Try to get slug from form
      const formElement = document.querySelector('form')
      if (formElement) {
        const slugInput = formElement.querySelector<HTMLInputElement>('input[name="slug"]')
        if (slugInput?.value) {
          setSlug(slugInput.value)
        }
      }
    }
  }, [id])

  if (!id) {
    return null
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this match?\n\n"${title}"\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/matches/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        toast.success('Match deleted successfully')
        router.push('/admin/collections/matches')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to delete match')
      }
    } catch (error) {
      console.error('Error deleting match:', error)
      toast.error('Error deleting match')
    } finally {
      setIsDeleting(false)
    }
  }

  const liveUrl = slug ? `https://elmt.gg/matches/${slug}` : null

  return (
    <div className="match-actions">
      {liveUrl && (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="match-actions__link"
        >
          <span>🌐</span>
          <span>View on Live Site</span>
          <span className="match-actions__arrow">→</span>
        </a>
      )}
      
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="match-actions__delete"
      >
        {isDeleting ? 'Deleting...' : '🗑️ Delete Match'}
      </button>
    </div>
  )
}

export default MatchActions
