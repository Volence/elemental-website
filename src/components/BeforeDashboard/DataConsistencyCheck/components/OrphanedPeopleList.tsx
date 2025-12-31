import React, { useState } from 'react'

interface OrphanedPerson {
  id: number | string
  name: string
  slug: string
  createdAt: string
}

interface OrphanedPeopleListProps {
  people: OrphanedPerson[]
  onPersonDeleted?: () => void
}

export const OrphanedPeopleList: React.FC<OrphanedPeopleListProps> = ({ 
  people, 
  onPersonDeleted 
}) => {
  const [deleting, setDeleting] = useState<number | string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<number | string>>(new Set())

  if (people.length === 0) return null

  const handleDelete = async (person: OrphanedPerson) => {
    if (!confirm(`Are you sure you want to delete "${person.name}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(person.id)
    try {
      const response = await fetch(`/api/people/${person.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete person')
      }

      // Mark as deleted
      setDeletedIds(prev => new Set(prev).add(person.id))
      
      // Notify parent to refresh data
      if (onPersonDeleted) {
        setTimeout(() => onPersonDeleted(), 500)
      }
    } catch (error) {
      console.error('Error deleting person:', error)
      alert('Failed to delete person. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const visiblePeople = people.filter(p => !deletedIds.has(p.id))

  if (visiblePeople.length === 0) {
    return (
      <div className="alert alert--success" style={{ marginBottom: '1.5rem' }}>
        <p>
          ✅ All orphaned people have been resolved!
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h4 className="mb-2 font-semibold">🚨 Orphaned People ({visiblePeople.length})</h4>
      <p className="text-sm mb-3 opacity-80">
        These People entries are not linked to any team (in any role) AND not assigned to any staff position 
        (organization or production). They may be unused entries or need to be linked.
      </p>
      <div className="grid gap-2">
        {visiblePeople.map((person) => (
          <div
            key={person.id}
            className="notification-item notification-item--warning"
          >
            <div className="notification-item__content">
              <strong>{person.name}</strong>
              <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.875rem' }}>({person.slug})</span>
            </div>
            <div className="notification-item__actions">
              <a
                href={`/admin/collections/people/${person.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="notification-btn notification-btn--view"
              >
                View
              </a>
              <button
                onClick={() => handleDelete(person)}
                disabled={deleting === person.id}
                className="notification-btn notification-btn--delete"
              >
                {deleting === person.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

