'use client'

import React, { useState, useEffect } from 'react'
import { DialogA11y } from '@/admin-kit'
import { Button } from '@payloadcms/ui'
import { RefreshCw, CheckCircle, AlertTriangle, Archive, RotateCcw, Pencil, Trophy } from 'lucide-react'
import RolloverModal from './RolloverModal'

/**
 * Header for the FaceIt Leagues list page.
 *
 * Top row: which FACEIT season we are on versus the latest one FACEIT has
 * published, the "Roll over" entry point, Sync All, and a warning pill for
 * enabled teams still pointed at an inactive league. Below: sync results and
 * the collapsible list of finalized seasons with restore actions.
 */

interface SeasonDetection {
  latest: { id: string; number: number; start: string | null; end: string | null } | null
  ours: number | null
  rolloverAvailable: boolean
}

const FaceitLeaguesHeader: React.FC = () => {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [progress, setProgress] = useState('')
  const [inactiveLeagueWarnings, setInactiveLeagueWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Season detection + rollover
  const [detection, setDetection] = useState<SeasonDetection | null>(null)
  const [detectionError, setDetectionError] = useState<string | null>(null)
  const [showRollover, setShowRollover] = useState(false)

  // Confirmation modal state
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<any>(null) // League to restore
  const [showRestoreSeasonConfirm, setShowRestoreSeasonConfirm] = useState<any>(null) // Team season to restore
  const [restoring, setRestoring] = useState(false)

  // Finalized (inactive) leagues
  const [finalizedLeagues, setFinalizedLeagues] = useState<any[]>([])

  useEffect(() => {
    fetchWarnings()
    fetchDetection()
  }, [])

  const fetchDetection = async () => {
    try {
      const res = await fetch('/api/faceit/rollover', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not reach FACEIT')
      setDetection(data.detection)
      setDetectionError(null)
    } catch (err: any) {
      setDetectionError(err.message)
    }
  }

  const fetchWarnings = async () => {
    try {
      setLoading(true)

      // Fetch all leagues
      const leaguesRes = await fetch('/api/faceit-leagues?limit=100')
      const leaguesData = await leaguesRes.json()
      const inactiveLeagues = leaguesData.docs.filter((l: any) => !l.isActive)

      // Only enabled, active teams count: disabled teams keep an old pointer
      // until the next rollover clears it, and that is not a problem.
      const warnings: any[] = []
      const inactiveIds = inactiveLeagues.map((l: any) => l.id)
      if (inactiveIds.length > 0) {
        const teamsRes = await fetch(
          `/api/teams?where[currentFaceitLeague][in]=${inactiveIds.join(',')}&where[faceitEnabled][equals]=true&where[active][not_equals]=false&limit=500&depth=0`,
        )
        const teamsData = await teamsRes.json()
        const leagueIdOf = (t: any) =>
          typeof t.currentFaceitLeague === 'object' ? t.currentFaceitLeague?.id : t.currentFaceitLeague
        for (const league of inactiveLeagues) {
          const teams = (teamsData.docs || []).filter((t: any) => leagueIdOf(t) === league.id)
          if (teams.length > 0) {
            warnings.push({ league, teamCount: teams.length, teams })
          }
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
      fetchDetection()
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

  const fmtStart = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''

  return (
    <div className="faceit-leagues-header">
      {/* Top Row: Season status + Actions + Warning */}
      <div className="faceit-leagues-header__top">
        <div className="faceit-leagues-header__actions">
          {detection && (
            <span className={`faceit-leagues-header__badge ${detection.rolloverAvailable ? 'faceit-leagues-header__badge--warning' : 'faceit-leagues-header__badge--success'}`}>
              <Trophy size={12} />{' '}
              {detection.ours != null ? `On Season ${detection.ours}` : 'No season tracked'}
              {detection.latest && detection.rolloverAvailable && (
                <> · Season {detection.latest.number} available{detection.latest.start ? ` (starts ${fmtStart(detection.latest.start)})` : ''}</>
              )}
              {detection.latest && !detection.rolloverAvailable && <> · current</>}
            </span>
          )}
          {detectionError && (
            <span className="faceit-leagues-header__badge faceit-leagues-header__badge--warning">
              <AlertTriangle size={12} /> {detectionError}
            </span>
          )}

          {detection?.rolloverAvailable && detection.latest && (
            <Button onClick={() => setShowRollover(true)} buttonStyle="primary">
              <Trophy size={12} /> Roll over to Season {detection.latest.number}
            </Button>
          )}

          <Button onClick={() => setShowSyncConfirm(true)} disabled={syncing} buttonStyle="secondary">
            {syncing ? 'Syncing...' : <><RefreshCw size={12} /> Sync All Active Leagues</>}
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
                <CheckCircle size={12} /> All teams on the current season
              </span>
            ) : (
              <details className="faceit-leagues-header__warning-details">
                <summary className="faceit-leagues-header__badge faceit-leagues-header__badge--warning">
                  <AlertTriangle size={12} /> {inactiveLeagueWarnings.reduce((acc, w) => acc + w.teamCount, 0)} teams on inactive leagues
                </summary>
                <ul className="faceit-leagues-header__warning-list">
                  {inactiveLeagueWarnings.flatMap((w) =>
                    w.teams.map((t: any) => (
                      <li key={t.id}>
                        <a className="faceit-leagues-header__team-link" href={`/admin/collections/teams/${t.id}`}>{t.name}</a> · {w.league.name}
                      </li>
                    )),
                  )}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Sync Results - Only show when there are results */}
      {results && (
        <div className={`faceit-leagues-header__results ${results.success ? 'faceit-leagues-header__results--success' : 'faceit-leagues-header__results--error'}`}>
          <div className="faceit-leagues-header__results-header">
            <span>{results.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}</span>
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
              <span className="faceit-leagues-header__finalized-icon"><Archive size={14} /></span>
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
                        <RotateCcw size={12} /> Restore
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
                              <Pencil size={12} /> Edit
                            </a>
                            <button
                              type="button"
                              className="faceit-leagues-header__team-season-restore"
                              onClick={() => setShowRestoreSeasonConfirm(season)}
                            >
                              <RotateCcw size={12} /> Restore
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
        <div className="confirm-modal-overlay" onClick={() => setShowRestoreConfirm(null)} role="presentation">
          <DialogA11y onClose={() => setShowRestoreConfirm(null)} />
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal__title"><RotateCcw size={14} /> Restore League</h3>
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
        <div className="confirm-modal-overlay" onClick={() => setShowRestoreSeasonConfirm(null)} role="presentation">
          <DialogA11y onClose={() => setShowRestoreSeasonConfirm(null)} />
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal__title"><RotateCcw size={14} /> Restore Team Season</h3>
            <div className="confirm-modal__message">
              <p>Restore <strong>{typeof showRestoreSeasonConfirm.team === 'object' ? showRestoreSeasonConfirm.team?.name : 'this team'}</strong> to active status?</p>
              <p style={{ marginTop: '0.5rem', color: 'var(--theme-elevation-500)' }}>
                This will resume FaceIt syncing for this team&apos;s season data.
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
        <div className="confirm-modal-overlay" onClick={() => setShowSyncConfirm(false)} role="presentation">
          <DialogA11y onClose={() => setShowSyncConfirm(false)} />
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal__title"><RefreshCw size={14} /> Sync All Teams</h3>
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

      {detection?.latest && (
        <RolloverModal
          open={showRollover}
          onClose={() => setShowRollover(false)}
          seasonId={detection.latest.id}
          seasonNumber={detection.latest.number}
          onApplied={() => { fetchWarnings(); fetchDetection() }}
        />
      )}
    </div>
  )
}

export default FaceitLeaguesHeader
