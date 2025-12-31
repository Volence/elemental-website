'use client'

import React, { useState } from 'react'
import { Button } from '@payloadcms/ui'

/**
 * Bulk sync button for FaceIt Leagues page
 * Syncs all teams in active leagues at once
 */
const FaceitBulkSync: React.FC = () => {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [progress, setProgress] = useState('')

  const handleSync = async () => {
    if (syncing) return

    const confirmed = window.confirm(
      'This will sync all teams in active FaceIt leagues. This may take a few minutes. Continue?'
    )
    
    if (!confirmed) return

    try {
      setSyncing(true)
      setProgress('Starting sync...')
      setResults(null)

      const response = await fetch('/api/faceit/sync-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResults(data)
        setProgress('')
      } else {
        setProgress('')
        setResults({
          success: false,
          error: data.error || 'Sync failed',
          summary: data.summary || {},
        })
      }
    } catch (error: any) {
      console.error('Bulk sync error:', error)
      setProgress('')
      setResults({
        success: false,
        error: error.message || 'Failed to sync',
        summary: {},
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="admin-spacing--section">
      <div className="admin-flex" style={{ marginBottom: results ? '1rem' : '0' }}>
        <Button
          onClick={handleSync}
          disabled={syncing}
          buttonStyle="primary"
        >
          {syncing ? 'Syncing...' : '🔄 Sync All Active Leagues'}
        </Button>
        
        {progress && (
          <span className="admin-text--small admin-text--muted" style={{ fontStyle: 'italic' }}>
            {progress}
          </span>
        )}
      </div>

      {/* Results Summary */}
      {results && (
        <div className={results.success ? 'admin-card--success' : 'admin-card--error'}>
          <div className="admin-flex" style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>
              {results.success ? '✅' : '❌'}
            </span>
            <span>
              {results.success ? 'Sync Complete' : 'Sync Failed'}
            </span>
          </div>

          {results.summary && (
            <div className="admin-grid" style={{ marginBottom: results.results?.length ? '1rem' : '0' }}>
              <div className="admin-stat-card">
                <div className="admin-stat-card__label">
                  Teams Synced
                </div>
                <div className="admin-stat-card__value">
                  {results.summary.successful || 0} / {results.summary.total || 0}
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-card__label">
                  Matches Created
                </div>
                <div className="admin-stat-card__value">
                  {results.summary.matchesCreated || 0}
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-card__label">
                  Matches Updated
                </div>
                <div className="admin-stat-card__value">
                  {results.summary.matchesUpdated || 0}
                </div>
              </div>

              {results.summary.failed > 0 && (
                <div className="admin-stat-card">
                  <div className="admin-stat-card__label">
                    Failed
                  </div>
                  <div className="admin-stat-card__value" style={{ color: 'rgb(248, 113, 113)' }}>
                    {results.summary.failed}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Results */}
          {results.results && results.results.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary className="admin-button--info admin-text--small" style={{ 
                cursor: 'pointer',
                display: 'inline-block',
                padding: '0.5rem 1rem',
              }}>
                View Details ({results.results.length} teams)
              </summary>
              <div className="admin-flex--column" style={{ marginTop: '0.75rem' }}>
                {results.results.map((result: any, index: number) => (
                  <div
                    key={index}
                    className={result.success ? 'admin-card--compact' : 'admin-card--error'}
                    style={{ padding: '0.75rem' }}
                  >
                    <div className="admin-flex--between admin-text--small">
                      <div className="admin-flex">
                        <span>{result.success ? '✓' : '✗'}</span>
                        <span style={{ fontWeight: 500 }}>{result.teamName}</span>
                      </div>
                      <div className="admin-text--muted">
                        {result.success ? (
                          <span>
                            {result.matchesCreated > 0 && `+${result.matchesCreated} new`}
                            {result.matchesCreated > 0 && result.matchesUpdated > 0 && ', '}
                            {result.matchesUpdated > 0 && `${result.matchesUpdated} updated`}
                            {result.matchesCreated === 0 && result.matchesUpdated === 0 && 'No changes'}
                          </span>
                        ) : (
                          <span style={{ color: 'rgb(248, 113, 113)' }}>
                            {result.error || 'Failed'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {results.error && (
            <div className="admin-card--compact admin-text--small" style={{
              marginTop: '1rem',
              color: 'rgb(248, 113, 113)',
            }}>
              <strong>Error:</strong> {results.error}
            </div>
          )}
        </div>
      )}

      <div className="admin-text--small admin-text--muted" style={{ marginTop: '0.75rem' }}>
        <strong>Note:</strong> This syncs all teams in active leagues. Teams are synced one at a time with a 1-second delay to avoid API rate limits.
      </div>
    </div>
  )
}

export default FaceitBulkSync



