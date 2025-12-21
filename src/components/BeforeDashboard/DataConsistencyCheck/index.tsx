'use client'

import React, { useState } from 'react'
import { GradientBorder } from '../GradientBorder'

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

  const hasIssues = report && (
    report.summary.orphanedCount > 0 ||
    report.summary.teamsWithIssuesCount > 0 ||
    report.summary.duplicateCount > 0
  )

  return (
    <GradientBorder>
      <div className="p-4 rounded bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
        <div className="flex justify-between items-center mb-3">
        <div>
          <strong>🔍 Data Consistency Check:</strong> Find orphaned People, teams with missing relationships, and duplicate entries.
        </div>
        <button 
          onClick={runCheck} 
          disabled={loading}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded cursor-pointer text-sm transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Checking...' : 'Run Check'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 mt-2">
          <strong>Error:</strong> {error}
        </div>
      )}

      {report && (
        <div className="mt-4">
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="p-2 bg-white dark:bg-gray-800 rounded min-w-[120px]">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total People</div>
              <div className="text-xl font-bold">{report.summary.totalPeople}</div>
            </div>
            <div className={`p-2 rounded min-w-[120px] ${report.summary.orphanedCount > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-green-50 dark:bg-green-950'}`}>
              <div className="text-sm text-gray-600 dark:text-gray-400">Orphaned</div>
              <div className={`text-xl font-bold ${report.summary.orphanedCount > 0 ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}`}>
                {report.summary.orphanedCount}
              </div>
            </div>
            <div className={`p-2 rounded min-w-[120px] ${report.summary.teamsWithIssuesCount > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-green-50 dark:bg-green-950'}`}>
              <div className="text-sm text-gray-600 dark:text-gray-400">Teams w/ Issues</div>
              <div className={`text-xl font-bold ${report.summary.teamsWithIssuesCount > 0 ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}`}>
                {report.summary.teamsWithIssuesCount}
              </div>
            </div>
            <div className={`p-2 rounded min-w-[120px] ${report.summary.duplicateCount > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-green-50 dark:bg-green-950'}`}>
              <div className="text-sm text-gray-600 dark:text-gray-400">Duplicates</div>
              <div className={`text-xl font-bold ${report.summary.duplicateCount > 0 ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}`}>
                {report.summary.duplicateCount}
              </div>
            </div>
          </div>

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
              {/* Orphaned People */}
              {report.orphanedPeople.length > 0 && (
                <div className="mb-6">
                  <h4 className="mb-2 font-semibold">
                    🚨 Orphaned People ({report.orphanedPeople.length})
                  </h4>
                  <p className="text-sm mb-3 opacity-80">
                    These People entries are not linked to any team or staff position. They may be unused or need to be linked.
                  </p>
                  <div className="grid gap-2">
                    {report.orphanedPeople.map((person) => (
                      <div 
                        key={person.id}
                        className="flex justify-between items-center p-3 rounded border bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
                      >
                        <div>
                          <strong>{person.name}</strong>
                          <span className="ml-2 opacity-70 text-sm">
                            ({person.slug})
                          </span>
                        </div>
                        <a 
                          href={`/admin/collections/people/${person.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm hover:bg-blue-700 transition-colors"
                        >
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teams with Missing Relationships */}
              {report.teamsWithMissingRelationships.length > 0 && (
                <div className="mb-6">
                  <h4 className="mb-2 font-semibold">
                    ⚠️ Teams with Missing Person Relationships ({report.teamsWithMissingRelationships.length})
                  </h4>
                  <p className="text-sm mb-3 opacity-80">
                    These teams have entries with names but no Person relationship. Consider linking them to People entries.
                  </p>
                  <div className="grid gap-2">
                    {report.teamsWithMissingRelationships.map((team) => (
                      <div 
                        key={team.teamId}
                        className="p-3 rounded border bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
                      >
                        <div className="mb-2">
                          <strong>{team.teamName}</strong>
                          <span className="ml-2 opacity-70 text-sm">
                            ({team.teamSlug})
                          </span>
                          <a 
                            href={`/admin/collections/teams/${team.teamId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm inline-block hover:bg-blue-700 transition-colors"
                          >
                            View
                          </a>
                        </div>
                        <ul className="m-0 pl-6 text-sm space-y-1">
                          {team.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicate People */}
              {report.duplicatePeople.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold">
                    🔄 Potential Duplicate People ({report.duplicatePeople.length})
                  </h4>
                  <p className="text-sm mb-3 opacity-80">
                    These People entries have very similar names and may be duplicates. Review and consider merging them.
                  </p>
                  <div className="grid gap-2">
                    {report.duplicatePeople.map((dup, idx) => (
                      <div 
                        key={idx}
                        className="flex justify-between items-center p-3 rounded border bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200"
                      >
                        <div>
                          <div>
                            <strong>{dup.person1.name}</strong>
                            <span className="ml-2 opacity-70 text-sm">
                              ({dup.person1.slug})
                            </span>
                            <a 
                              href={`/admin/collections/people/${dup.person1.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm inline-block hover:bg-blue-700 transition-colors"
                            >
                              View
                            </a>
                          </div>
                          <div className="mt-1">
                            <strong>{dup.person2.name}</strong>
                            <span className="ml-2 opacity-70 text-sm">
                              ({dup.person2.slug})
                            </span>
                            <a 
                              href={`/admin/collections/people/${dup.person2.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 px-2 py-1 bg-blue-600 text-white rounded no-underline text-sm inline-block hover:bg-blue-700 transition-colors"
                            >
                              View
                            </a>
                          </div>
                          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Similarity: {Math.round(dup.similarity * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasIssues && (
                <div className="p-4 text-center text-green-700 dark:text-green-300">
                  ✅ <strong>No issues found!</strong> Your data is consistent.
                </div>
              )}
            </div>
          )}

          {report && !hasIssues && (
            <div className="p-3 rounded bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 mt-2">
              ✅ <strong>All good!</strong> No orphaned People, teams with missing relationships, or duplicate entries found.
            </div>
          )}
        </div>
      )}
      </div>
    </GradientBorder>
  )
}

export default DataConsistencyCheck
