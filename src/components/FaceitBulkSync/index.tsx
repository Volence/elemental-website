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
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem',
        marginBottom: results ? '1rem' : '0'
      }}>
        <Button
          onClick={handleSync}
          disabled={syncing}
          buttonStyle="primary"
        >
          {syncing ? 'Syncing...' : '🔄 Sync All Active Leagues'}
        </Button>
        
        {progress && (
          <span style={{ 
            fontSize: '0.875rem', 
            color: 'var(--theme-elevation-700)',
            fontStyle: 'italic'
          }}>
            {progress}
          </span>
        )}
      </div>

      {/* Results Summary */}
      {results && (
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: results.success 
            ? 'rgba(34, 197, 94, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${results.success 
            ? 'rgba(34, 197, 94, 0.3)' 
            : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '0.5rem',
        }}>
          <div style={{ 
            fontWeight: '600', 
            marginBottom: '0.75rem',
            color: 'var(--theme-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.25rem' }}>
              {results.success ? '✅' : '❌'}
            </span>
            <span>
              {results.success ? 'Sync Complete' : 'Sync Failed'}
            </span>
          </div>

          {results.summary && (
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.75rem',
              marginBottom: results.results?.length ? '1rem' : '0'
            }}>
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'var(--theme-elevation-100)',
                borderRadius: '0.375rem',
              }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--theme-elevation-700)',
                  marginBottom: '0.25rem'
                }}>
                  Teams Synced
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700',
                  color: 'var(--theme-text)'
                }}>
                  {results.summary.successful || 0} / {results.summary.total || 0}
                </div>
              </div>

              <div style={{
                padding: '0.75rem',
                backgroundColor: 'var(--theme-elevation-100)',
                borderRadius: '0.375rem',
              }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--theme-elevation-700)',
                  marginBottom: '0.25rem'
                }}>
                  Matches Created
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700',
                  color: 'var(--theme-text)'
                }}>
                  {results.summary.matchesCreated || 0}
                </div>
              </div>

              <div style={{
                padding: '0.75rem',
                backgroundColor: 'var(--theme-elevation-100)',
                borderRadius: '0.375rem',
              }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--theme-elevation-700)',
                  marginBottom: '0.25rem'
                }}>
                  Matches Updated
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700',
                  color: 'var(--theme-text)'
                }}>
                  {results.summary.matchesUpdated || 0}
                </div>
              </div>

              {results.summary.failed > 0 && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '0.375rem',
                }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--theme-elevation-700)',
                    marginBottom: '0.25rem'
                  }}>
                    Failed
                  </div>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '700',
                    color: 'rgb(248, 113, 113)'
                  }}>
                    {results.summary.failed}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Results */}
          {results.results && results.results.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ 
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--theme-text)',
                padding: '0.5rem',
                backgroundColor: 'var(--theme-elevation-100)',
                borderRadius: '0.25rem',
                display: 'inline-block',
              }}>
                View Details ({results.results.length} teams)
              </summary>
              <div style={{ 
                marginTop: '0.75rem',
                display: 'grid',
                gap: '0.5rem',
              }}>
                {results.results.map((result: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: result.success 
                        ? 'var(--theme-elevation-100)'
                        : 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '0.375rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{result.success ? '✓' : '✗'}</span>
                      <span style={{ fontWeight: '500' }}>{result.teamName}</span>
                    </div>
                    <div style={{ color: 'var(--theme-elevation-700)' }}>
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
                ))}
              </div>
            </details>
          )}

          {results.error && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'var(--theme-elevation-100)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              color: 'rgb(248, 113, 113)',
            }}>
              <strong>Error:</strong> {results.error}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '0.75rem',
        fontSize: '0.75rem',
        color: 'var(--theme-elevation-700)',
      }}>
        <strong>Note:</strong> This syncs all teams in active leagues. Teams are synced one at a time with a 1-second delay to avoid API rate limits.
      </div>
    </div>
  )
}

export default FaceitBulkSync


