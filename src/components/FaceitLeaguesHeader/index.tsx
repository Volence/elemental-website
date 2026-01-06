'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@payloadcms/ui'

/**
 * Consolidated header for FaceIt Leagues list page
 * Combines sync functionality and status notifications in a clean layout
 */
const FaceitLeaguesHeader: React.FC = () => {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [progress, setProgress] = useState('')
  const [inactiveLeagueWarnings, setInactiveLeagueWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWarnings()
  }, [])

  const fetchWarnings = async () => {
    try {
      setLoading(true)
      
      // Fetch all leagues
      const leaguesRes = await fetch('/api/faceit-leagues?limit=100')
      const leaguesData = await leaguesRes.json()
      const inactiveLeagues = leaguesData.docs.filter((l: any) => !l.isActive)
      
      // For each inactive league, check how many teams are using it
      const warnings = []
      for (const league of inactiveLeagues) {
        const teamsRes = await fetch(`/api/teams?where[currentFaceitLeague][equals]=${league.id}&limit=100`)
        const teamsData = await teamsRes.json()
        
        if (teamsData.docs.length > 0) {
          warnings.push({
            league: league,
            teamCount: teamsData.totalDocs,
            teams: teamsData.docs,
          })
        }
      }
      
      setInactiveLeagueWarnings(warnings)
    } catch (error) {
      console.error('Error fetching FaceIt league warnings:', error)
    } finally {
      setLoading(false)
    }
  }

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
    <div className="faceit-leagues-header">
      {/* Top Row: Actions + Status */}
      <div className="faceit-leagues-header__top">
        <div className="faceit-leagues-header__actions">
          <Button
            onClick={handleSync}
            disabled={syncing}
            buttonStyle="primary"
          >
            {syncing ? 'Syncing...' : '🔄 Sync All Active Leagues'}
          </Button>
          
          {progress && (
            <span className="faceit-leagues-header__progress">
              {progress}
            </span>
          )}
        </div>
        
        {/* Status Badge */}
        {!loading && (
          <div className="faceit-leagues-header__status">
            {inactiveLeagueWarnings.length === 0 ? (
              <span className="faceit-leagues-header__badge faceit-leagues-header__badge--success">
                ✅ All leagues up to date
              </span>
            ) : (
              <span className="faceit-leagues-header__badge faceit-leagues-header__badge--warning">
                ⚠️ {inactiveLeagueWarnings.reduce((acc, w) => acc + w.teamCount, 0)} teams on inactive leagues
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sync Results - Only show when there are results */}
      {results && (
        <div className={`faceit-leagues-header__results ${results.success ? 'faceit-leagues-header__results--success' : 'faceit-leagues-header__results--error'}`}>
          <div className="faceit-leagues-header__results-header">
            <span>{results.success ? '✅' : '❌'}</span>
            <span>{results.success ? 'Sync Complete' : 'Sync Failed'}</span>
          </div>

          {results.summary && (
            <div className="faceit-leagues-header__results-stats">
              <div className="faceit-leagues-header__stat">
                <span className="faceit-leagues-header__stat-value">{results.summary.successful || 0}/{results.summary.total || 0}</span>
                <span className="faceit-leagues-header__stat-label">Teams</span>
              </div>
              <div className="faceit-leagues-header__stat">
                <span className="faceit-leagues-header__stat-value">{results.summary.matchesCreated || 0}</span>
                <span className="faceit-leagues-header__stat-label">Created</span>
              </div>
              <div className="faceit-leagues-header__stat">
                <span className="faceit-leagues-header__stat-value">{results.summary.matchesUpdated || 0}</span>
                <span className="faceit-leagues-header__stat-label">Updated</span>
              </div>
            </div>
          )}

          {results.error && (
            <div className="faceit-leagues-header__results-error">
              {results.error}
            </div>
          )}
        </div>
      )}

      {/* Warnings - Only show if there are inactive league issues */}
      {inactiveLeagueWarnings.length > 0 && (
        <div className="faceit-leagues-header__warnings">
          {inactiveLeagueWarnings.map((warning) => (
            <details key={warning.league.id} className="faceit-leagues-header__warning">
              <summary>
                <span className="faceit-leagues-header__warning-icon">⚠️</span>
                <span className="faceit-leagues-header__warning-text">
                  {warning.teamCount} {warning.teamCount === 1 ? 'team' : 'teams'} on inactive league "{warning.league.name}"
                </span>
              </summary>
              <div className="faceit-leagues-header__warning-content">
                <p className="faceit-leagues-header__warning-hint">
                  Update these teams to an active league:
                </p>
                <div className="faceit-leagues-header__team-list">
                  {warning.teams.map((team: any) => (
                    <a
                      key={team.id}
                      href={`/admin/collections/teams/${team.id}`}
                      className="faceit-leagues-header__team-link"
                    >
                      {team.name} <span>→</span>
                    </a>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

export default FaceitLeaguesHeader
