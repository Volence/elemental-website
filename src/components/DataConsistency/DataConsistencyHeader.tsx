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
  // Don't render anything if there are no auto-fixable issues
  if (autoFixableCount === 0) return null

  return (
    <div className="data-consistency-header">
      <button
        onClick={onFixAll}
        disabled={fixing}
        className="data-consistency-header__fix-button"
      >
        {fixing ? 'Fixing...' : `Fix All Auto-Fixable Issues (${autoFixableCount})`}
      </button>
    </div>
  )
}
