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
      <h4 className="mb-2 font-semibold">Potential Duplicate People ({duplicates.length})</h4>
      <p className="text-sm mb-3 opacity-80">
        These People entries have very similar names and may be duplicates. Review and consider
        merging them.
      </p>
      <div className="grid gap-2">
        {duplicates.map((dup, idx) => (
          <div
            key={idx}
            className="notification-item notification-item--warning dc-check__issue-item"
          >
            <div className="dc-check__full-width">
              <div className="dc-check__pair-row">
                <strong>{dup.person1.name}</strong>
                <span className="dc-check__slug">({dup.person1.slug})</span>
                <a
                  href={`/admin/collections/people/${dup.person1.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="notification-btn notification-btn--view dc-check__view-link"
                >
                  View
                </a>
              </div>
              <div className="dc-check__pair-row">
                <strong>{dup.person2.name}</strong>
                <span className="dc-check__slug">({dup.person2.slug})</span>
                <a
                  href={`/admin/collections/people/${dup.person2.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="notification-btn notification-btn--view dc-check__view-link"
                >
                  View
                </a>
              </div>
              <div className="dc-check__similarity">
                Similarity: {Math.round(dup.similarity * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
