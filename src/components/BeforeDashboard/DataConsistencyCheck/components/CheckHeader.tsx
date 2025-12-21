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
        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded cursor-pointer text-sm transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Checking...' : 'Run Check'}
      </button>
    </div>
  )
}

