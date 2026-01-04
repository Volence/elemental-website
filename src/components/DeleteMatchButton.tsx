'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@payloadcms/ui'

interface DeleteMatchButtonProps {
  id: number
  title: string
}

export const DeleteMatchButton: React.FC<DeleteMatchButtonProps> = ({ id, title }) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

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
        // Redirect back to matches list
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

  return (
    <div 
      className="delete-match-container"
      style={{ 
        marginTop: '2rem', 
        paddingTop: '2rem', 
        borderTop: '1px solid rgba(255, 255, 255, 0.1)' 
      }}
    >
      <Button
        onClick={handleDelete}
        disabled={isDeleting}
        buttonStyle="error"
      >
        {isDeleting ? 'Deleting...' : '🗑️ Delete This Match'}
      </Button>
      <p style={{ 
        marginTop: '0.5rem', 
        fontSize: '0.875rem', 
        color: 'rgba(255, 255, 255, 0.6)',
        fontStyle: 'italic'
      }}>
        This will permanently delete this match. This action cannot be undone.
      </p>
    </div>
  )
}

export default DeleteMatchButton

