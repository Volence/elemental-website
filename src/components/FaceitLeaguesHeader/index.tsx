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
  
  // Finalize season state
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeFilter, setFinalizeFilter] = useState('')
  const [finalizeResults, setFinalizeResults] = useState<any>(null)
  const [allActiveLeagues, setAllActiveLeagues] = useState<any[]>([])
  
  // Confirmation modal state
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<any>(null) // League to restore
  const [showRestoreSeasonConfirm, setShowRestoreSeasonConfirm] = useState<any>(null) // Team season to restore
  const [restoring, setRestoring] = useState(false)
  
  // Finalized (inactive) leagues
  const [finalizedLeagues, setFinalizedLeagues] = useState<any[]>([])
  
  // Compute matching leagues based on filter
  const matchingLeagues = finalizeFilter.trim()
    ? allActiveLeagues.filter(league => 
        league.name.toLowerCase().includes(finalizeFilter.toLowerCase())
      )
    : []

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
      
      // Store all finalized (inactive) leagues with their team seasons
      const finalizedWithSeasons = await Promise.all(
        inactiveLeagues.map(async (league: any) => {
          const seasonsRes = await fetch(`/api/faceit-seasons?where[faceitLeague][equals]=${league.id}&depth=1&limit=50`)
          const seasonsData = await seasonsRes.json()
          return {
            ...league,
            teamSeasons: seasonsData.docs || [],
          }
        })
      )
      setFinalizedLeagues(finalizedWithSeasons)
      
      // Fetch all active leagues for finalize preview
      const activeLeagues = leaguesData.docs.filter((l: any) => l.isActive)
      setAllActiveLeagues(activeLeagues)
    } catch (error) {
      console.error('Error fetching FaceIt league warnings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    if (syncing) return
    setShowSyncConfirm(false)

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

  const handleFinalizeSeason = async () => {
    if (finalizing || matchingLeagues.length === 0) return
    setShowFinalizeConfirm(false)

    try {
      setFinalizing(true)
      setFinalizeResults(null)

      const response = await fetch('/api/faceit/finalize-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameFilter: finalizeFilter }),
      })

      const data = await response.json()
      setFinalizeResults(data)
      
      // Refresh data after finalization
      if (data.success) {
        fetchWarnings()
        setFinalizeFilter('')
      }
    } catch (error: any) {
      setFinalizeResults({
        success: false,
        error: error.message || 'Failed to finalize',
      })
    } finally {
      setFinalizing(false)
    }
  }

  const handleRestoreLeague = async () => {
    if (!showRestoreConfirm || restoring) return
    
    try {
      setRestoring(true)
      const leagueId = showRestoreConfirm.id
      
      // Restore the league first
      await fetch(`/api/faceit-leagues/${leagueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      
      // Restore all team seasons for this league
      const seasonsRes = await fetch(`/api/faceit-seasons?where[faceitLeague][equals]=${leagueId}&limit=100`)
      const seasonsData = await seasonsRes.json()
      
      for (const season of seasonsData.docs) {
        await fetch(`/api/faceit-seasons/${season.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true, archivedAt: null }),
        })
      }
      
      // Refresh data
      setShowRestoreConfirm(null)
      fetchWarnings()
    } catch (error: any) {
      console.error('Failed to restore league:', error)
    } finally {
      setRestoring(false)
    }
  }

  const handleRestoreTeamSeason = async () => {
    if (!showRestoreSeasonConfirm || restoring) return
    
    try {
      setRestoring(true)
      const seasonId = showRestoreSeasonConfirm.id
      const leagueId = typeof showRestoreSeasonConfirm.faceitLeague === 'object' 
        ? showRestoreSeasonConfirm.faceitLeague?.id 
        : showRestoreSeasonConfirm.faceitLeague
      
      // Restore the team season
      await fetch(`/api/faceit-seasons/${seasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isActive: true, 
          archivedAt: null,
        }),
      })
      
      // Also restore the parent league so it moves out of finalized section
      if (leagueId) {
        await fetch(`/api/faceit-leagues/${leagueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        })
      }
      
      // Refresh data
      setShowRestoreSeasonConfirm(null)
      fetchWarnings()
    } catch (error: any) {
      console.error('Failed to restore team season:', error)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="faceit-leagues-header">
      {/* Top Row: Actions + Status */}
      <div className="faceit-leagues-header__top">
        <div className="faceit-leagues-header__actions">
          <Button
            onClick={() => setShowSyncConfirm(true)}
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
          
          {/* Finalize Season */}
          <div className="faceit-leagues-header__finalize">
            <input
              type="text"
              placeholder="Filter leagues (e.g. '7' or '7 playoffs')"
              value={finalizeFilter}
              onChange={(e) => setFinalizeFilter(e.target.value)}
              className="faceit-leagues-header__filter-input"
              disabled={finalizing}
            />
            <Button
              onClick={() => matchingLeagues.length > 0 && setShowFinalizeConfirm(true)}
              disabled={finalizing || matchingLeagues.length === 0}
              buttonStyle="secondary"
            >
              {finalizing ? 'Finalizing...' : `🏁 Finalize (${matchingLeagues.length})`}
            </Button>
          </div>
          
          {/* Live preview of matching leagues */}
          {matchingLeagues.length > 0 && (
            <div className="faceit-leagues-header__preview">
              <span className="faceit-leagues-header__preview-label">Will finalize:</span>
              {matchingLeagues.slice(0, 5).map(league => (
                <span key={league.id} className="faceit-leagues-header__preview-tag">
                  {league.name}
                </span>
              ))}
              {matchingLeagues.length > 5 && (
                <span className="faceit-leagues-header__preview-more">
                  +{matchingLeagues.length - 5} more
                </span>
              )}
            </div>
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
      
      {/* Finalize Results */}
      {finalizeResults && (
        <div className={`faceit-leagues-header__results ${finalizeResults.success && !(finalizeResults.errors?.length > 0) ? 'faceit-leagues-header__results--success' : 'faceit-leagues-header__results--error'}`}>
          <div className="faceit-leagues-header__results-header">
            <span>{finalizeResults.success && !(finalizeResults.errors?.length > 0) ? '🏁' : '❌'}</span>
            <span>{finalizeResults.success && !(finalizeResults.errors?.length > 0) 
              ? `Finalized ${finalizeResults.leaguesFinalized || 0} League(s)` 
              : 'Finalize Failed'}</span>
          </div>

          {finalizeResults.success && !(finalizeResults.errors?.length > 0) && (
            <div className="faceit-leagues-header__results-stats">
              <div className="faceit-leagues-header__stat">
                <span className="faceit-leagues-header__stat-value">{finalizeResults.leaguesFinalized || 0}</span>
                <span className="faceit-leagues-header__stat-label">Leagues</span>
              </div>
              <div className="faceit-leagues-header__stat">
                <span className="faceit-leagues-header__stat-value">{finalizeResults.seasonsArchived || 0}</span>
                <span className="faceit-leagues-header__stat-label">Teams</span>
              </div>
              <div className="faceit-leagues-header__stat">
                <span className="faceit-leagues-header__stat-value">{finalizeResults.matchesArchived || 0}</span>
                <span className="faceit-leagues-header__stat-label">Matches Archived</span>
              </div>
            </div>
          )}

          {finalizeResults.error && (
            <div className="faceit-leagues-header__results-error">
              {finalizeResults.error}
            </div>
          )}
          
          {finalizeResults.errors?.length > 0 && (
            <div className="faceit-leagues-header__results-error">
              {finalizeResults.errors.join(', ')}
            </div>
          )}
        </div>
      )}

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
      
      {/* Finalized Seasons Section */}
      {finalizedLeagues.length > 0 && (
        <div className="faceit-leagues-header__finalized">
          <details className="faceit-leagues-header__finalized-details">
            <summary className="faceit-leagues-header__finalized-summary">
              <span className="faceit-leagues-header__finalized-icon">📦</span>
              <span className="faceit-leagues-header__finalized-title">
                Finalized Seasons ({finalizedLeagues.length})
              </span>
            </summary>
            <div className="faceit-leagues-header__finalized-content">
              <p className="faceit-leagues-header__finalized-hint">
                These leagues have been finalized and are no longer syncing. Click on team seasons to edit archived match data.
              </p>
              <div className="faceit-leagues-header__finalized-list">
                {finalizedLeagues.map((league: any) => (
                  <details key={league.id} className="faceit-leagues-header__finalized-item-details">
                    <summary className="faceit-leagues-header__finalized-item">
                      <div className="faceit-leagues-header__finalized-info">
                        <span className="faceit-leagues-header__finalized-name">{league.name}</span>
                        {(league.teamSeasons?.length > 0 || league.archivedAt) && (
                          <span className="faceit-leagues-header__finalized-meta">
                            {league.teamSeasons?.length > 0 && `${league.teamSeasons.length} team(s)`}
                            {league.teamSeasons?.length > 0 && league.archivedAt && ' • '}
                            {league.archivedAt && `Finalized ${new Date(league.archivedAt).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="faceit-leagues-header__finalized-btn faceit-leagues-header__finalized-btn--restore"
                        onClick={(e) => { e.stopPropagation(); setShowRestoreConfirm(league); }}
                      >
                        🔄 Restore
                      </button>
                    </summary>
                    {league.teamSeasons?.length > 0 && (
                      <div className="faceit-leagues-header__team-seasons">
                        {league.teamSeasons.map((season: any) => (
                          <div key={season.id} className="faceit-leagues-header__team-season">
                            <span className="faceit-leagues-header__team-season-name">
                              {typeof season.team === 'object' ? season.team?.name : `Team ID: ${season.team}`}
                            </span>
                            <span className="faceit-leagues-header__team-season-matches">
                              {season.archivedMatches?.length || 0} archived matches
                            </span>
                            <a
                              href={`/admin/collections/faceit-seasons/${season.id}`}
                              className="faceit-leagues-header__team-season-edit"
                            >
                              ✏️ Edit
                            </a>
                            <button
                              type="button"
                              className="faceit-leagues-header__team-season-restore"
                              onClick={() => setShowRestoreSeasonConfirm(season)}
                            >
                              🔄 Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
      
      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowRestoreConfirm(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal__title">🔄 Restore League</h3>
            <div className="confirm-modal__message">
              <p>Restore <strong>{showRestoreConfirm.name}</strong> to active status?</p>
              <p style={{ marginTop: '0.5rem', color: 'var(--theme-elevation-500)' }}>
                This will reactivate the league and all associated team seasons, resuming syncing.
              </p>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--cancel"
                onClick={() => setShowRestoreConfirm(null)}
                disabled={restoring}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--info"
                onClick={handleRestoreLeague}
                disabled={restoring}
              >
                {restoring ? 'Restoring...' : 'Restore League'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Team Season Restore Confirmation Modal */}
      {showRestoreSeasonConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowRestoreSeasonConfirm(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal__title">🔄 Restore Team Season</h3>
            <div className="confirm-modal__message">
              <p>Restore <strong>{typeof showRestoreSeasonConfirm.team === 'object' ? showRestoreSeasonConfirm.team?.name : 'this team'}</strong> to active status?</p>
              <p style={{ marginTop: '0.5rem', color: 'var(--theme-elevation-500)' }}>
                This will resume FaceIt syncing for this team's season data.
              </p>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--cancel"
                onClick={() => setShowRestoreSeasonConfirm(null)}
                disabled={restoring}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--info"
                onClick={handleRestoreTeamSeason}
                disabled={restoring}
              >
                {restoring ? 'Restoring...' : 'Restore Team'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Sync Confirmation Modal */}
      {showSyncConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowSyncConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal__title">🔄 Sync All Teams</h3>
            <div className="confirm-modal__message">
              <p>This will sync data for all teams in active FaceIt leagues.</p>
              <p style={{ marginTop: '0.5rem', color: 'var(--theme-elevation-500)' }}>
                This may take a few minutes to complete.
              </p>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--cancel"
                onClick={() => setShowSyncConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--info"
                onClick={handleSync}
              >
                Start Sync
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Finalize Confirmation Modal */}
      {showFinalizeConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowFinalizeConfirm(false)}>
          <div className="confirm-modal confirm-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal__title">⚠️ Finalize {matchingLeagues.length} League(s)</h3>
            <div className="confirm-modal__content">
              {/* Leagues Section */}
              <div className="confirm-modal__section">
                <div className="confirm-modal__section-header">
                  <span className="confirm-modal__section-icon">🏆</span>
                  <span className="confirm-modal__section-title">Leagues to Finalize</span>
                </div>
                <div className="confirm-modal__tags">
                  {matchingLeagues.slice(0, 8).map(league => (
                    <span key={league.id} className="confirm-modal__tag">{league.name}</span>
                  ))}
                  {matchingLeagues.length > 8 && (
                    <span className="confirm-modal__tag confirm-modal__tag--more">+{matchingLeagues.length - 8} more</span>
                  )}
                </div>
              </div>

              {/* Actions Section */}
              <div className="confirm-modal__section confirm-modal__section--actions">
                <div className="confirm-modal__section-header">
                  <span className="confirm-modal__section-icon">📋</span>
                  <span className="confirm-modal__section-title">What Will Happen</span>
                </div>
                <div className="confirm-modal__action-list">
                  <div className="confirm-modal__action-item">
                    <span className="confirm-modal__action-icon">📦</span>
                    <span>Archive all match history</span>
                  </div>
                  <div className="confirm-modal__action-item">
                    <span className="confirm-modal__action-icon">🔒</span>
                    <span>Mark leagues as INACTIVE</span>
                  </div>
                  <div className="confirm-modal__action-item">
                    <span className="confirm-modal__action-icon">👥</span>
                    <span>Mark team seasons as INACTIVE</span>
                  </div>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="confirm-modal__notice confirm-modal__notice--warning">
                <span className="confirm-modal__notice-icon">⚡</span>
                <span>This preserves data but <strong>stops future syncing</strong> for these leagues.</span>
              </div>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--cancel"
                onClick={() => setShowFinalizeConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--warning"
                onClick={handleFinalizeSeason}
              >
                🏁 Finalize Leagues
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FaceitLeaguesHeader
