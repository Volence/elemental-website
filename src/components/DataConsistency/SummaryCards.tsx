import React from 'react'

interface SummaryCardsProps {
  errorCount: number
  warningCount: number
  autoFixableCount: number
}

export function SummaryCards({ errorCount, warningCount, autoFixableCount }: SummaryCardsProps) {
  return (
    <div className="summary-cards">
      {/* Errors Card */}
      <div className={`summary-card summary-card--errors ${errorCount === 0 ? 'summary-card--success' : ''}`}>
        <h3 className="summary-card__value">{errorCount}</h3>
        <p className="summary-card__label">Critical Errors</p>
      </div>

      {/* Warnings Card */}
      <div className={`summary-card summary-card--warnings ${warningCount === 0 ? 'summary-card--success' : ''}`}>
        <h3 className="summary-card__value">{warningCount}</h3>
        <p className="summary-card__label">Warnings</p>
      </div>

      {/* Auto-Fixable Card */}
      <div className="summary-card summary-card--fixable">
        <h3 className="summary-card__value">{autoFixableCount}</h3>
        <p className="summary-card__label">Auto-Fixable</p>
      </div>
    </div>
  )
}
