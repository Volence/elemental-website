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
            className="notification-item notification-item--warning"
            style={{ flexDirection: 'column' as const, alignItems: 'flex-start' }}
          >
            <div style={{ width: '100%' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>{dup.person1.name}</strong>
                <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.875rem' }}>({dup.person1.slug})</span>
                <a
                  href={`/admin/collections/people/${dup.person1.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="notification-btn notification-btn--view"
                  style={{ marginLeft: '0.5rem' }}
                >
                  View
                </a>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>{dup.person2.name}</strong>
                <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.875rem' }}>({dup.person2.slug})</span>
                <a
                  href={`/admin/collections/people/${dup.person2.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="notification-btn notification-btn--view"
                  style={{ marginLeft: '0.5rem' }}
                >
                  View
                </a>
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                Similarity: {Math.round(dup.similarity * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

