import React from 'react'

interface CheckHeaderProps {
  loading: boolean
  onRunCheck: () => void
}

export const CheckHeader: React.FC<CheckHeaderProps> = ({ loading, onRunCheck }) => {
  return (
    <div className="flex justify-between items-center mb-3">
      <div>
        <strong className="text-gray-300">🔍 Data Consistency Check:</strong>{' '}
        <span className="text-gray-400">
          Find orphaned People, teams with missing relationships, and duplicate entries.
        </span>
      </div>
      <button
        onClick={onRunCheck}
        disabled={loading}
        className="notification-btn notification-btn--primary"
        style={{ marginLeft: '1rem' }}
      >
        {loading ? 'Checking...' : 'Run Check'}
      </button>
    </div>
  )
}

