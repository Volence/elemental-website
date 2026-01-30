'use client'

import React, { useState, useEffect } from 'react'
import { formatLocalDateTime } from '@/utilities/formatDateTime'

interface TeamCardInfo {
  id: number
  name: string
  slug?: string
  logo?: string
  region?: string
  division?: string
  discordCardMessageId?: string | null
  updatedAt: string
}

interface RefreshResult {
  success: boolean
  message: string
  stats?: {
    total: number
    updated: number
    failed: number
  }
  errors?: string[]
  error?: string
}

interface TeamCardsTabProps {
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

export default function TeamCardsTab({ onAlert }: TeamCardsTabProps) {
  const [teams, setTeams] = useState<TeamCardInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<'full' | 'soft' | null>(null)
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/teams?limit=100&depth=1&sort=name', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const teamData: TeamCardInfo[] = data.docs.map((team: any) => {
          // Extract logo URL from upload relationship (prefer filename for static path)
          let logoUrl: string | undefined = undefined
          if (team.logo) {
            if (typeof team.logo === 'string') {
              logoUrl = team.logo
            } else if (typeof team.logo === 'object') {
              // Prefer filename-based static path
              if (team.logo.filename) {
                logoUrl = `/graphics-assets/${team.logo.filename}`
              } else if (team.logo.url) {
                logoUrl = team.logo.url
              }
            }
          }
          
          return {
            id: team.id,
            name: team.name,
            slug: team.slug,
            logo: logoUrl,
            region: team.region,
            division: typeof team.currentFaceitLeague === 'object' 
              ? team.currentFaceitLeague?.division 
              : undefined,
            discordCardMessageId: team.discordCardMessageId,
            updatedAt: team.updatedAt,
          }
        })
        setTeams(teamData)
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFullRefresh = async () => {
    if (!confirm('⚠️ Full Refresh will DELETE ALL cards and repost them in order.\n\nThis rebuilds the entire card list from scratch.\n\nContinue?')) {
      return
    }
    
    setRefreshing('full')
    setLastResult(null)
    
    try {
      const response = await fetch('/api/discord/team-cards/refresh-all', {
        method: 'POST',
        credentials: 'include',
      })
      
      const result = await response.json()
      setLastResult(result)
      
      if (result.success) {
        onAlert('Success', 'Full refresh completed!', 'success')
        await fetchTeams()
      } else {
        onAlert('Error', result.error || 'Failed to refresh', 'error')
      }
    } catch (error: any) {
      setLastResult({
        success: false,
        message: error.message || 'Failed to refresh cards',
      })
      onAlert('Error', error.message, 'error')
    } finally {
      setRefreshing(null)
    }
  }

  const handleSoftRefresh = async () => {
    setRefreshing('soft')
    setLastResult(null)
    
    try {
      const response = await fetch('/api/discord/team-cards/update-all', {
        method: 'POST',
        credentials: 'include',
      })
      
      const result = await response.json()
      setLastResult(result)
      
      if (result.success) {
        onAlert('Success', result.message, 'success')
        await fetchTeams()
      } else {
        onAlert('Error', result.error || 'Failed to update', 'error')
      }
    } catch (error: any) {
      setLastResult({
        success: false,
        message: error.message || 'Failed to update cards',
      })
      onAlert('Error', error.message, 'error')
    } finally {
      setRefreshing(null)
    }
  }

  const teamsWithCards = teams.filter(t => t.discordCardMessageId)
  const teamsWithoutCards = teams.filter(t => !t.discordCardMessageId)

  if (loading) {
    return <div className="loading-state">Loading team cards...</div>
  }

  return (
    <div className="team-cards-tab">
      <div className="team-cards-header">
        <h3>🎴 Team Cards</h3>
        <p className="description">
          Manage team embeds in the Discord cards channel. Cards are automatically updated when team data changes.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="team-cards-actions">
        <button
          onClick={handleSoftRefresh}
          disabled={refreshing !== null}
          className="action-btn action-btn--soft"
        >
          {refreshing === 'soft' ? '🔃 Updating...' : '🔃 Soft Refresh'}
        </button>
        
        <button
          onClick={handleFullRefresh}
          disabled={refreshing !== null}
          className="action-btn action-btn--full"
        >
          {refreshing === 'full' ? '🔄 Refreshing...' : '🔄 Full Refresh'}
        </button>
        
        <div className="action-info">
          <p><strong>Soft Refresh:</strong> Updates each card in-place. Fast, preserves order.</p>
          <p><strong>Full Refresh:</strong> Deletes all cards and reposts in sorted order. Use to fix ordering.</p>
        </div>
      </div>

      {/* Result Message */}
      {lastResult && (
        <div className={`result-message ${lastResult.success ? 'result-message--success' : 'result-message--error'}`}>
          <strong>{lastResult.success ? '✅' : '❌'} {lastResult.message}</strong>
          {lastResult.stats && (
            <p>
              Total: {lastResult.stats.total} | 
              Updated: {lastResult.stats.updated} | 
              Failed: {lastResult.stats.failed}
            </p>
          )}
          {lastResult.errors && lastResult.errors.length > 0 && (
            <details>
              <summary>View Errors ({lastResult.errors.length})</summary>
              <ul>
                {lastResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Stats Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{teams.length}</div>
          <div className="stat-label">Total Teams</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-value--success">{teamsWithCards.length}</div>
          <div className="stat-label">With Card</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-value--warning">{teamsWithoutCards.length}</div>
          <div className="stat-label">Missing Card</div>
        </div>
      </div>

      {/* Teams Table */}
      <div className="teams-table-container">
        <table className="teams-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Region</th>
              <th>Division</th>
              <th>Card Status</th>
              <th>Message ID</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id}>
                <td>
                  <div className="team-cell">
                    {team.logo && (
                      <img 
                        src={team.logo} 
                        alt="" 
                        className="team-logo"
                      />
                    )}
                    <strong>{team.name}</strong>
                  </div>
                </td>
                <td>{team.region || '—'}</td>
                <td>{team.division || '—'}</td>
                <td>
                  {team.discordCardMessageId ? (
                    <span className="status-badge status-badge--success">✅ Posted</span>
                  ) : (
                    <span className="status-badge status-badge--warning">⚠️ No Card</span>
                  )}
                </td>
                <td>
                  {team.discordCardMessageId ? (
                    <code className="message-id" title={team.discordCardMessageId}>
                      {team.discordCardMessageId.slice(0, 8)}...
                    </code>
                  ) : (
                    <span className="no-id">—</span>
                  )}
                </td>
                <td className="time-cell">
                  {formatLocalDateTime(team.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slash Commands Section */}
      <div className="commands-section">
        <h4>📝 Bot Commands</h4>
        <div className="commands-list">
          <div className="command-item">
            <code>/schedulepoll</code>
            <span>Create a scheduling poll for match times</span>
          </div>
          <div className="command-item">
            <code>/team [name]</code>
            <span>Display team info as an embed</span>
          </div>
          <div className="command-item">
            <code>/ping</code>
            <span>Check if the bot is online</span>
          </div>
        </div>
      </div>
    </div>
  )
}
