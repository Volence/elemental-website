import React from 'react'

interface SummaryCardsProps {
  errorCount: number
  warningCount: number
  autoFixableCount: number
}

export function SummaryCards({ errorCount, warningCount, autoFixableCount }: SummaryCardsProps) {
  return (
    <div className="dc-stats">
      {/* Errors Card */}
      <div className={`dc-stat dc-stat--error ${errorCount === 0 ? 'dc-stat--zero' : ''}`}>
        <span className="dc-stat__value">{errorCount}</span>
        <span className="dc-stat__label">Critical Errors</span>
      </div>

      {/* Warnings Card */}
      <div className={`dc-stat dc-stat--warning ${warningCount === 0 ? 'dc-stat--zero' : ''}`}>
        <span className="dc-stat__value">{warningCount}</span>
        <span className="dc-stat__label">Warnings</span>
      </div>

      {/* Auto-Fixable Card */}
      <div className="dc-stat dc-stat--info">
        <span className="dc-stat__value">{autoFixableCount}</span>
        <span className="dc-stat__label">Auto-Fixable</span>
      </div>
    </div>
  )
}
