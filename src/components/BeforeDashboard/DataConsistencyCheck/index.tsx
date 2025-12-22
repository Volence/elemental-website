'use client'

import React, { useState } from 'react'
import { GradientBorder } from '../GradientBorder'
import { CheckHeader } from './components/CheckHeader'
import { SummaryCards } from './components/SummaryCards'
import { OrphanedPeopleList } from './components/OrphanedPeopleList'
import { TeamsWithIssuesList } from './components/TeamsWithIssuesList'
import { DuplicatePeopleList } from './components/DuplicatePeopleList'

interface DataConsistencyReport {
  orphanedPeople: Array<{
    id: number
    name: string
    slug: string
    createdAt: string
  }>
  teamsWithMissingRelationships: Array<{
    teamId: number
    teamName: string
    teamSlug: string
    issues: string[]
  }>
  duplicatePeople: Array<{
    person1: { id: number; name: string; slug: string }
    person2: { id: number; name: string; slug: string }
    similarity: number
  }>
  summary: {
    totalPeople: number
    totalTeams: number
    orphanedCount: number
    teamsWithIssuesCount: number
    duplicateCount: number
  }
}

const DataConsistencyCheck: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<DataConsistencyReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const runCheck = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/check-data-consistency')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to check data consistency')
      }

      setReport(data.data)
      setShowDetails(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check data consistency'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const hasIssues =
    report &&
    (report.summary.orphanedCount > 0 ||
      report.summary.teamsWithIssuesCount > 0 ||
      report.summary.duplicateCount > 0)

  return (
    <GradientBorder>
      <div className="p-4 rounded">
        <CheckHeader loading={loading} onRunCheck={runCheck} />

        {error && (
          <div className="p-3 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 mt-2">
            <strong>Error:</strong> {error}
          </div>
        )}

        {report && (
          <div className="mt-4">
            <SummaryCards
              totalPeople={report.summary.totalPeople}
              orphanedCount={report.summary.orphanedCount}
              teamsWithIssuesCount={report.summary.teamsWithIssuesCount}
              duplicateCount={report.summary.duplicateCount}
            />

            {hasIssues && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded cursor-pointer text-sm transition-colors hover:bg-blue-700"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            )}

            {showDetails && hasIssues && (
              <div className="mt-4 max-h-[500px] overflow-y-auto p-4 rounded border bg-white border-gray-300 text-gray-800 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200">
                <OrphanedPeopleList 
                  people={report.orphanedPeople} 
                  onPersonDeleted={runCheck}
                />
                <TeamsWithIssuesList teams={report.teamsWithMissingRelationships} />
                <DuplicatePeopleList duplicates={report.duplicatePeople} />

                {!hasIssues && (
                  <div className="p-4 text-center text-green-700 dark:text-green-300">
                    ✅ <strong>No issues found!</strong> Your data is consistent.
                  </div>
                )}
              </div>
            )}

            {report && !hasIssues && (
              <div className="p-3 rounded bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 mt-2">
                ✅ <strong>All good!</strong> All People are linked to either a team or a staff position. 
                No teams with missing relationships or duplicate entries found.
              </div>
            )}
          </div>
        )}
      </div>
    </GradientBorder>
  )
}

export default DataConsistencyCheck
