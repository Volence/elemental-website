'use client'

import React, { useState } from 'react'
import './index.scss'

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
    <div className="dataConsistencyCheck">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <strong>🔍 Data Consistency Check:</strong> Find orphaned People, teams with missing relationships, and duplicate entries.
        </div>
        <button 
          onClick={runCheck} 
          disabled={loading}
          className="dataConsistencyCheck__button"
          style={{ marginLeft: '1rem' }}
        >
          {loading ? 'Checking...' : 'Run Check'}
        </button>
      </div>

      {error && (
        <div className="dataConsistencyCheck__error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {report && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', minWidth: '120px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Total People</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{report.summary.totalPeople}</div>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: report.summary.orphanedCount > 0 ? '#fff3cd' : '#e8f5e9', borderRadius: '4px', minWidth: '120px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Orphaned</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: report.summary.orphanedCount > 0 ? '#856404' : '#2e7d32' }}>
                {report.summary.orphanedCount}
              </div>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: report.summary.teamsWithIssuesCount > 0 ? '#fff3cd' : '#e8f5e9', borderRadius: '4px', minWidth: '120px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Teams w/ Issues</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: report.summary.teamsWithIssuesCount > 0 ? '#856404' : '#2e7d32' }}>
                {report.summary.teamsWithIssuesCount}
              </div>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: report.summary.duplicateCount > 0 ? '#fff3cd' : '#e8f5e9', borderRadius: '4px', minWidth: '120px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Duplicates</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: report.summary.duplicateCount > 0 ? '#856404' : '#2e7d32' }}>
                {report.summary.duplicateCount}
              </div>
            </div>
          </div>

          {hasIssues && (
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="dataConsistencyCheck__button"
              style={{ marginBottom: '1rem' }}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          )}

          {showDetails && hasIssues && (
            <div className="dataConsistencyCheck__details-box">
              {/* Orphaned People */}
              {report.orphanedPeople.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>
                    🚨 Orphaned People ({report.orphanedPeople.length})
                  </h4>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.8 }}>
                    These People entries are not linked to any team or staff position. They may be unused or need to be linked.
                  </p>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {report.orphanedPeople.map((person) => (
                      <div 
                        key={person.id}
                        className="dataConsistencyCheck__issue-item"
                        style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <strong>{person.name}</strong>
                          <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>
                            ({person.slug})
                          </span>
                        </div>
                        <a 
                          href={`/admin/collections/people/${person.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            padding: '0.25rem 0.5rem', 
                            backgroundColor: '#2196f3', 
                            color: '#fff', 
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontSize: '0.85rem'
                          }}
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
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>
                    ⚠️ Teams with Missing Person Relationships ({report.teamsWithMissingRelationships.length})
                  </h4>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.8 }}>
                    These teams have entries with names but no Person relationship. Consider linking them to People entries.
                  </p>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {report.teamsWithMissingRelationships.map((team) => (
                      <div 
                        key={team.teamId}
                        className="dataConsistencyCheck__issue-item"
                      >
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>{team.teamName}</strong>
                          <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>
                            ({team.teamSlug})
                          </span>
                          <a 
                            href={`/admin/collections/teams/${team.teamId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dataConsistencyCheck__view-link"
                            style={{ marginLeft: '0.5rem' }}
                          >
                            View
                          </a>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                          {team.issues.map((issue, idx) => (
                            <li key={idx} style={{ marginBottom: '0.25rem' }}>{issue}</li>
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
                  <h4 style={{ marginBottom: '0.5rem' }}>
                    🔄 Potential Duplicate People ({report.duplicatePeople.length})
                  </h4>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.8 }}>
                    These People entries have very similar names and may be duplicates. Review and consider merging them.
                  </p>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {report.duplicatePeople.map((dup, idx) => (
                      <div 
                        key={idx}
                        className="dataConsistencyCheck__issue-item"
                        style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div>
                            <strong>{dup.person1.name}</strong>
                            <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>
                              ({dup.person1.slug})
                            </span>
                            <a 
                              href={`/admin/collections/people/${dup.person1.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ 
                                marginLeft: '0.5rem',
                                padding: '0.25rem 0.5rem', 
                                backgroundColor: '#2196f3', 
                                color: '#fff', 
                                borderRadius: '4px',
                                textDecoration: 'none',
                                fontSize: '0.85rem'
                              }}
                            >
                              View
                            </a>
                          </div>
                          <div style={{ marginTop: '0.25rem' }}>
                            <strong>{dup.person2.name}</strong>
                            <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>
                              ({dup.person2.slug})
                            </span>
                            <a 
                              href={`/admin/collections/people/${dup.person2.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dataConsistencyCheck__view-link"
                              style={{ marginLeft: '0.5rem' }}
                            >
                              View
                            </a>
                          </div>
                          <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
                            Similarity: {Math.round(dup.similarity * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasIssues && (
                <div className="dataConsistencyCheck__success-message" style={{ padding: '1rem', textAlign: 'center' }}>
                  ✅ <strong>No issues found!</strong> Your data is consistent.
                </div>
              )}
            </div>
          )}

          {report && !hasIssues && (
            <div className="dataConsistencyCheck__stat-box--success" style={{ padding: '0.75rem', borderRadius: '4px', marginTop: '0.5rem' }}>
              ✅ <strong>All good!</strong> No orphaned People, teams with missing relationships, or duplicate entries found.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DataConsistencyCheck
