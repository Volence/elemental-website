'use client'

import React, { useState } from 'react'
import { Button } from '@payloadcms/ui'
import { CheckCircle, RefreshCw, XCircle } from 'lucide-react'

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
      <div className={`admin-flex faceit-bulk__actions${results ? '' : ' faceit-bulk__actions--no-results'}`}>
        <Button
          onClick={handleSync}
          disabled={syncing}
          buttonStyle="primary"
        >
          {syncing ? 'Syncing...' : <><RefreshCw size={12} /> Sync All Active Leagues</>}
        </Button>
        
        {progress && (
          <span className="admin-text--small admin-text--muted faceit-bulk__progress">
            {progress}
          </span>
        )}
      </div>

      {/* Results Summary */}
      {results && (
        <div className={results.success ? 'admin-card--success' : 'admin-card--error'}>
          <div className="admin-flex faceit-bulk__results-header">
            <span className="faceit-bulk__results-icon">
              {results.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
            </span>
            <span>
              {results.success ? 'Sync Complete' : 'Sync Failed'}
            </span>
          </div>

          {results.summary && (
            <div className={`admin-grid faceit-bulk__stats${results.results?.length ? '' : ' faceit-bulk__stats--no-details'}`}>
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
                  <div className="admin-stat-card__value faceit-bulk__value--error">
                    {results.summary.failed}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Results */}
          {results.results && results.results.length > 0 && (
            <details className="faceit-bulk__details">
              <summary className="admin-button--info admin-text--small faceit-bulk__details-summary">
                View Details ({results.results.length} teams)
              </summary>
              <div className="admin-flex--column faceit-bulk__details-list">
                {results.results.map((result: any, index: number) => (
                  <div
                    key={index}
                    className={`${result.success ? 'admin-card--compact' : 'admin-card--error'} faceit-bulk__detail-card`}
                  >
                    <div className="admin-flex--between admin-text--small">
                      <div className="admin-flex">
                        <span>{result.success ? '✓' : '✗'}</span>
                        <span className="faceit-bulk__team-name">{result.teamName}</span>
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
                          <span className="faceit-bulk__error-text">
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
            <div className="admin-card--compact admin-text--small faceit-bulk__error-card">
              <strong>Error:</strong> {results.error}
            </div>
          )}
        </div>
      )}

      <div className="admin-text--small admin-text--muted faceit-bulk__note">
        <strong>Note:</strong> This syncs all teams in active leagues. Teams are synced one at a time with a 1-second delay to avoid API rate limits.
      </div>
    </div>
  )
}

export default FaceitBulkSync
