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
          <div className="alert alert--error">
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
                className="notification-btn notification-btn--primary"
                style={{ marginBottom: '1rem' }}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            )}

            {showDetails && hasIssues && (
              <div style={{ 
                marginTop: '1.5rem', 
                maxHeight: '500px', 
                overflowY: 'auto' as const,
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.03)',
                backdropFilter: 'blur(8px)'
              }}>
                <OrphanedPeopleList 
                  people={report.orphanedPeople} 
                  onPersonDeleted={runCheck}
                />
                <TeamsWithIssuesList teams={report.teamsWithMissingRelationships} />
                <DuplicatePeopleList duplicates={report.duplicatePeople} />
              </div>
            )}

            {report && !hasIssues && (
              <div className="alert alert--success">
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
