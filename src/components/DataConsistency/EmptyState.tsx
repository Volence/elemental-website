import React from 'react'

export function EmptyState() {
  return (
    <div className="data-consistency-empty">
      <h2 className="data-consistency-empty__title">✅ All Clear!</h2>
      <p className="data-consistency-empty__message">
        No data consistency issues detected.
      </p>
    </div>
  )
}
