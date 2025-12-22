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
      <div className="mb-6 p-4 rounded border border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-700">
        <p className="text-green-800 dark:text-green-200">
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
            className="flex justify-between items-center p-3 rounded border bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
          >
            <div>
              <strong>{person.name}</strong>
              <span className="ml-2 opacity-70 text-sm">({person.slug})</span>
            </div>
            <div className="flex gap-2">
              <a
                href={`/admin/collections/people/${person.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm hover:bg-blue-700 transition-colors"
              >
                View
              </a>
              <button
                onClick={() => handleDelete(person)}
                disabled={deleting === person.id}
                className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

