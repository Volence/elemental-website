import React from 'react'

interface SummaryCardsProps {
  totalPeople: number
  orphanedCount: number
  teamsWithIssuesCount: number
  duplicateCount: number
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalPeople,
  orphanedCount,
  teamsWithIssuesCount,
  duplicateCount,
}) => {
  return (
    <div className="flex gap-4 mb-4 flex-wrap">
      <div className="p-2 bg-white dark:bg-gray-800 rounded min-w-[120px]">
        <div className="text-sm text-gray-600 dark:text-gray-400">Total People</div>
        <div className="text-xl font-bold">{totalPeople}</div>
      </div>

      <div
        className={`p-2 rounded min-w-[120px] ${
          orphanedCount > 0
            ? 'bg-yellow-50 dark:bg-yellow-950'
            : 'bg-green-50 dark:bg-green-950'
        }`}
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">Orphaned</div>
        <div
          className={`text-xl font-bold ${
            orphanedCount > 0
              ? 'text-yellow-700 dark:text-yellow-300'
              : 'text-green-700 dark:text-green-300'
          }`}
        >
          {orphanedCount}
        </div>
      </div>

      <div
        className={`p-2 rounded min-w-[120px] ${
          teamsWithIssuesCount > 0
            ? 'bg-yellow-50 dark:bg-yellow-950'
            : 'bg-green-50 dark:bg-green-950'
        }`}
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">Teams w/ Issues</div>
        <div
          className={`text-xl font-bold ${
            teamsWithIssuesCount > 0
              ? 'text-yellow-700 dark:text-yellow-300'
              : 'text-green-700 dark:text-green-300'
          }`}
        >
          {teamsWithIssuesCount}
        </div>
      </div>

      <div
        className={`p-2 rounded min-w-[120px] ${
          duplicateCount > 0
            ? 'bg-yellow-50 dark:bg-yellow-950'
            : 'bg-green-50 dark:bg-green-950'
        }`}
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">Duplicates</div>
        <div
          className={`text-xl font-bold ${
            duplicateCount > 0
              ? 'text-yellow-700 dark:text-yellow-300'
              : 'text-green-700 dark:text-green-300'
          }`}
        >
          {duplicateCount}
        </div>
      </div>
    </div>
  )
}

