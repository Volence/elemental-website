import React from 'react'

interface DuplicatePair {
  person1: { id: number; name: string; slug: string }
  person2: { id: number; name: string; slug: string }
  similarity: number
}

interface DuplicatePeopleListProps {
  duplicates: DuplicatePair[]
}

export const DuplicatePeopleList: React.FC<DuplicatePeopleListProps> = ({ duplicates }) => {
  if (duplicates.length === 0) return null

  return (
    <div>
      <h4 className="mb-2 font-semibold">🔄 Potential Duplicate People ({duplicates.length})</h4>
      <p className="text-sm mb-3 opacity-80">
        These People entries have very similar names and may be duplicates. Review and consider
        merging them.
      </p>
      <div className="grid gap-2">
        {duplicates.map((dup, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center p-3 rounded border bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
          >
            <div>
              <div>
                <strong>{dup.person1.name}</strong>
                <span className="ml-2 opacity-70 text-sm">({dup.person1.slug})</span>
                <a
                  href={`/admin/collections/people/${dup.person1.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm inline-block hover:bg-blue-700 transition-colors"
                >
                  View
                </a>
              </div>
              <div className="mt-1">
                <strong>{dup.person2.name}</strong>
                <span className="ml-2 opacity-70 text-sm">({dup.person2.slug})</span>
                <a
                  href={`/admin/collections/people/${dup.person2.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm inline-block hover:bg-blue-700 transition-colors"
                >
                  View
                </a>
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Similarity: {Math.round(dup.similarity * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

