import React from 'react'

interface OrphanedPerson {
  id: number
  name: string
  slug: string
  createdAt: string
}

interface OrphanedPeopleListProps {
  people: OrphanedPerson[]
}

export const OrphanedPeopleList: React.FC<OrphanedPeopleListProps> = ({ people }) => {
  if (people.length === 0) return null

  return (
    <div className="mb-6">
      <h4 className="mb-2 font-semibold">🚨 Orphaned People ({people.length})</h4>
      <p className="text-sm mb-3 opacity-80">
        These People entries are not linked to any team (in any role) AND not assigned to any staff position 
        (organization or production). They may be unused entries or need to be linked.
      </p>
      <div className="grid gap-2">
        {people.map((person) => (
          <div
            key={person.id}
            className="flex justify-between items-center p-3 rounded border bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
          >
            <div>
              <strong>{person.name}</strong>
              <span className="ml-2 opacity-70 text-sm">({person.slug})</span>
            </div>
            <a
              href={`/admin/collections/people/${person.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm hover:bg-blue-700 transition-colors"
            >
              View
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

