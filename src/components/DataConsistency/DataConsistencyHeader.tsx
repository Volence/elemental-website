import React from 'react'

interface DataConsistencyHeaderProps {
  autoFixableCount: number
  fixing: boolean
  onFixAll: () => void
}

export function DataConsistencyHeader({
  autoFixableCount,
  fixing,
  onFixAll,
}: DataConsistencyHeaderProps) {
  return (
    <div className="data-consistency-header">
      <h1 className="data-consistency-header__title">📊 Data Consistency Dashboard</h1>
      {autoFixableCount > 0 && (
        <button
          onClick={onFixAll}
          disabled={fixing}
          className="data-consistency-header__fix-button"
        >
          {fixing ? 'Fixing...' : `Fix All Auto-Fixable Issues (${autoFixableCount})`}
        </button>
      )}
    </div>
  )
}
