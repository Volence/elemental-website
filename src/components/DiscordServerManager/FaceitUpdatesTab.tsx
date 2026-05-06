'use client'

import React, { useState, useEffect } from 'react'
import { formatLocalDateTime } from '@/utilities/formatDateTime'
import { CheckCircle, RefreshCw, Trophy, XCircle } from 'lucide-react'

interface TeamInfo {
  id: number
  name: string
  region?: string
  division?: string
  discordEmoji?: string
  discordFaceitUpdateMessageId?: string | null
  updatedAt: string
}

interface RefreshResult {
  success: boolean
  message: string
  error?: string
}

interface FaceitUpdatesTabProps {
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

export default function FaceitUpdatesTab({ onAlert }: FaceitUpdatesTabProps) {
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/teams?limit=100&depth=1&sort=name&where[faceitEnabled][equals]=true', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()

        const seasonRes = await fetch('/api/faceit-seasons?limit=100&depth=0&where[isActive][equals]=true', {
          credentials: 'include',
        })
        const seasonData = seasonRes.ok ? await seasonRes.json() : { docs: [] }
        const divisionByTeamId = new Map<number, string>()
        for (const s of seasonData.docs) {
          const teamId = typeof s.team === 'object' ? s.team.id : s.team
          if (teamId) divisionByTeamId.set(teamId, s.division || '')
        }

        setTeams(
          data.docs.map((t: any) => ({
            id: t.id,
            name: t.name,
            region: t.region,
            division: divisionByTeamId.get(t.id) || '-',
            discordEmoji: t.discordEmoji,
            discordFaceitUpdateMessageId: t.discordFaceitUpdateMessageId,
            updatedAt: t.updatedAt,
          })),
        )
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFullRefresh = async () => {
    if (
      !confirm(
        'This will DELETE all FaceIt update embeds and repost them in the correct order (region, then division).\n\nContinue?',
      )
    ) {
      return
    }

    setRefreshing(true)
    setLastResult(null)

    try {
      const response = await fetch('/api/discord/faceit-updates/refresh-all', {
        method: 'POST',
        credentials: 'include',
      })

      const result = await response.json()
      setLastResult(result)

      if (result.success) {
        onAlert('Success', result.message, 'success')
        await fetchTeams()
      } else {
        onAlert('Error', result.error || 'Failed to refresh', 'error')
      }
    } catch (error: any) {
      setLastResult({ success: false, message: error.message || 'Failed to refresh' })
      onAlert('Error', error.message, 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const teamsWithEmbed = teams.filter((t) => t.discordFaceitUpdateMessageId)
  const teamsWithoutEmbed = teams.filter((t) => !t.discordFaceitUpdateMessageId)

  if (loading) {
    return <div className="loading-state">Loading FaceIt teams...</div>
  }

  const regionOrder = ['NA', 'EMEA', 'SA', 'OCE']
  const divisionOrder = ['Masters', 'Expert', 'Advanced', 'Open']
  const sortedTeams = [...teams].sort((a, b) => {
    const rA = regionOrder.indexOf(a.region || 'EMEA')
    const rB = regionOrder.indexOf(b.region || 'EMEA')
    if (rA !== rB) return rA - rB
    const dA = divisionOrder.indexOf(a.division || 'Open')
    const dB = divisionOrder.indexOf(b.division || 'Open')
    if (dA !== dB) return dA - dB
    return (a.name || '').localeCompare(b.name || '')
  })

  return (
    <div className="team-cards-tab">
      <div className="team-cards-header">
        <h3>
          <Trophy size={14} /> FaceIt Updates Channel
        </h3>
        <p className="description">
          Persistent embeds in #faceit-updates showing standings and recent results per team. Auto-updates
          after every FaceIt sync.
        </p>
      </div>

      <div className="team-cards-actions">
        <button onClick={handleFullRefresh} disabled={refreshing} className="action-btn action-btn--full">
          <RefreshCw size={12} className={refreshing ? 'spinning' : ''} />{' '}
          {refreshing ? 'Refreshing...' : 'Full Refresh'}
        </button>

        <div className="action-info">
          <p>
            <strong>Full Refresh:</strong> Deletes all embeds and reposts in sorted order (region, then
            division). Use to fix ordering.
          </p>
        </div>
      </div>

      {lastResult && (
        <div
          className={`result-message ${lastResult.success ? 'result-message--success' : 'result-message--error'}`}
        >
          <strong>
            {lastResult.success ? <CheckCircle size={12} /> : <XCircle size={12} />} {lastResult.message}
          </strong>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{teams.length}</div>
          <div className="stat-label">FaceIt Teams</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-value--success">{teamsWithEmbed.length}</div>
          <div className="stat-label">With Embed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-value--warning">{teamsWithoutEmbed.length}</div>
          <div className="stat-label">Missing Embed</div>
        </div>
      </div>

      <div className="teams-table-container">
        <table className="teams-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Region</th>
              <th>Division</th>
              <th>Embed Status</th>
              <th>Message ID</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => (
              <tr key={team.id}>
                <td>
                  <strong>
                    {team.discordEmoji || ''} {team.name}
                  </strong>
                </td>
                <td>{team.region || '-'}</td>
                <td>{team.division || '-'}</td>
                <td>
                  {team.discordFaceitUpdateMessageId ? (
                    <span className="status-badge status-badge--success">
                      <CheckCircle size={12} /> Posted
                    </span>
                  ) : (
                    <span className="status-badge status-badge--warning">No Embed</span>
                  )}
                </td>
                <td>
                  {team.discordFaceitUpdateMessageId ? (
                    <code className="message-id" title={team.discordFaceitUpdateMessageId}>
                      {team.discordFaceitUpdateMessageId.slice(0, 8)}...
                    </code>
                  ) : (
                    <span className="no-id">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
