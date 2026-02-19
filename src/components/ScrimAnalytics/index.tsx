'use client'

import React, { useEffect, useState } from 'react'
import RangeFilter, { type RangeValue } from '@/components/RangeFilter'
import './ScrimAnalytics.scss'

interface MapStat {
  mapName: string
  wins: number
  losses: number
  draws: number
  winRate: number
}

interface ScrimRecord {
  date: string
  ourRating?: string
  opponentRating?: string
  worthScrimAgain?: string
  mapsPlayed?: Array<{
    mapName: string
    result: 'win' | 'loss' | 'draw'
    score?: string
  }>
  scrimNotes?: string
}

interface OpponentStat {
  opponentTeamId: number | null
  opponentName: string
  totalScrims: number
  latestWorthScrimAgain?: string
  latestOurRating?: string
  latestOpponentRating?: string
  scrims: ScrimRecord[]
  mapStats: Record<string, { wins: number; losses: number; draws: number }>
}

interface AnalyticsData {
  teamId: number
  totalScrims: number
  uniqueOpponents: number
  opponents: OpponentStat[]
  mapStats: MapStat[]
}

interface ScrimAnalyticsProps {
  teamId: number
  teamName?: string
}

const ratingLabels: Record<string, { label: string; emoji: string }> = {
  easywin: { label: 'Easy Win', emoji: '😎' },
  closewin: { label: 'Close Win', emoji: '😅' },
  neutral: { label: 'Neutral', emoji: '😐' },
  closeloss: { label: 'Close Loss', emoji: '😤' },
  gotrolled: { label: 'Got Rolled', emoji: '💀' },
}

const strengthLabels: Record<string, { label: string; emoji: string }> = {
  weak: { label: 'Weak', emoji: '🟢' },
  average: { label: 'Average', emoji: '🟡' },
  strong: { label: 'Strong', emoji: '🟠' },
  verystrong: { label: 'Very Strong', emoji: '🔴' },
}

const worthLabels: Record<string, { label: string; emoji: string; color: string }> = {
  yes: { label: 'Yes', emoji: '✅', color: '#22c55e' },
  maybe: { label: 'Maybe', emoji: '🤔', color: '#f59e0b' },
  no: { label: 'No', emoji: '❌', color: '#ef4444' },
}

export const ScrimAnalytics: React.FC<ScrimAnalyticsProps> = ({ teamId, teamName }) => {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'opponents' | 'maps'>('opponents')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedOpponent, setExpandedOpponent] = useState<string | null>(null)
  const [range, setRange] = useState<RangeValue>('last20')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/scrim-analytics?teamId=${teamId}&range=${range}`)
        if (!res.ok) throw new Error('Failed to fetch analytics')
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [teamId, range])

  if (loading) {
    return <div className="scrim-analytics scrim-analytics--loading">Loading analytics...</div>
  }

  if (error) {
    return <div className="scrim-analytics scrim-analytics--error">Error: {error}</div>
  }

  if (!data) {
    return <div className="scrim-analytics scrim-analytics--empty">No data available</div>
  }

  const filteredOpponents = data.opponents.filter(opp =>
    opp.opponentName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="scrim-analytics">
      <div className="scrim-analytics__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>📊 Scrim Analytics {teamName && `- ${teamName}`}</h2>
          <div className="scrim-analytics__summary">
            <span className="scrim-analytics__stat">
              <strong>{data.totalScrims}</strong> total scrims
            </span>
            <span className="scrim-analytics__stat">
              <strong>{data.uniqueOpponents}</strong> unique opponents
            </span>
          </div>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <div className="scrim-analytics__tabs">
        <button
          className={`scrim-analytics__tab ${activeTab === 'opponents' ? 'scrim-analytics__tab--active' : ''}`}
          onClick={() => setActiveTab('opponents')}
        >
          👥 Opponent Lookup
        </button>
        <button
          className={`scrim-analytics__tab ${activeTab === 'maps' ? 'scrim-analytics__tab--active' : ''}`}
          onClick={() => setActiveTab('maps')}
        >
          🗺️ Map Performance
        </button>
      </div>

      {activeTab === 'opponents' && (
        <div className="scrim-analytics__opponents">
          <input
            type="text"
            className="scrim-analytics__search"
            placeholder="Search opponents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="scrim-analytics__opponent-list">
            {filteredOpponents.length === 0 ? (
              <div className="scrim-analytics__no-results">No opponents found</div>
            ) : (
              filteredOpponents.map((opp) => {
                const isExpanded = expandedOpponent === opp.opponentName
                const worth = opp.latestWorthScrimAgain ? worthLabels[opp.latestWorthScrimAgain] : null

                return (
                  <div key={opp.opponentName} className="scrim-analytics__opponent-card">
                    <div
                      className="scrim-analytics__opponent-header"
                      onClick={() => setExpandedOpponent(isExpanded ? null : opp.opponentName)}
                    >
                      <div className="scrim-analytics__opponent-info">
                        <span className="scrim-analytics__opponent-name">{opp.opponentName}</span>
                        <span className="scrim-analytics__opponent-count">({opp.totalScrims} scrims)</span>
                      </div>
                      {worth && (
                        <span
                          className="scrim-analytics__worth-badge"
                          style={{ backgroundColor: worth.color }}
                        >
                          {worth.emoji} {worth.label}
                        </span>
                      )}
                      <span className="scrim-analytics__expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    </div>

                    {isExpanded && (
                      <div className="scrim-analytics__opponent-details">
                        <div className="scrim-analytics__latest">
                          <h4>Latest Assessment</h4>
                          <div className="scrim-analytics__ratings">
                            {opp.latestOurRating && ratingLabels[opp.latestOurRating] && (
                              <span className="scrim-analytics__rating">
                                Our Performance: {ratingLabels[opp.latestOurRating].emoji} {ratingLabels[opp.latestOurRating].label}
                              </span>
                            )}
                            {opp.latestOpponentRating && strengthLabels[opp.latestOpponentRating] && (
                              <span className="scrim-analytics__rating">
                                Their Strength: {strengthLabels[opp.latestOpponentRating].emoji} {strengthLabels[opp.latestOpponentRating].label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Map Stats vs This Opponent */}
                        {Object.keys(opp.mapStats).length > 0 && (
                          <div className="scrim-analytics__opponent-maps">
                            <h4>Map Record vs {opp.opponentName}</h4>
                            <div className="scrim-analytics__map-grid">
                              {Object.entries(opp.mapStats).map(([mapName, stats]) => {
                                const total = stats.wins + stats.losses + stats.draws
                                const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0
                                return (
                                  <div key={mapName} className="scrim-analytics__map-mini">
                                    <span className="scrim-analytics__map-name">{mapName}</span>
                                    <span className={`scrim-analytics__map-rate ${winRate >= 50 ? 'scrim-analytics__map-rate--good' : 'scrim-analytics__map-rate--bad'}`}>
                                      {stats.wins}W-{stats.losses}L ({winRate}%)
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Scrim History Timeline */}
                        <div className="scrim-analytics__history">
                          <h4>Scrim History</h4>
                          <div className="scrim-analytics__timeline">
                            {opp.scrims.map((scrim, i) => (
                              <div key={i} className="scrim-analytics__timeline-item">
                                <span className="scrim-analytics__timeline-date">{scrim.date}</span>
                                <div className="scrim-analytics__timeline-content">
                                  {scrim.ourRating && ratingLabels[scrim.ourRating] && (
                                    <span>{ratingLabels[scrim.ourRating].emoji} {ratingLabels[scrim.ourRating].label}</span>
                                  )}
                                  {scrim.worthScrimAgain && worthLabels[scrim.worthScrimAgain] && (
                                    <span>→ Worth it? {worthLabels[scrim.worthScrimAgain].emoji}</span>
                                  )}
                                  {scrim.scrimNotes && (
                                    <p className="scrim-analytics__timeline-notes">{scrim.scrimNotes}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'maps' && (
        <div className="scrim-analytics__maps">
          <h3>Overall Map Performance</h3>
          {data.mapStats.length === 0 ? (
            <div className="scrim-analytics__no-results">No map data yet</div>
          ) : (
            <table className="scrim-analytics__map-table">
              <thead>
                <tr>
                  <th>Map</th>
                  <th>W</th>
                  <th>L</th>
                  <th>D</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.mapStats.map((map) => (
                  <tr key={map.mapName} className={map.winRate < 50 ? 'scrim-analytics__row--weak' : ''}>
                    <td className="scrim-analytics__map-cell">{map.mapName}</td>
                    <td className="scrim-analytics__win-cell">{map.wins}</td>
                    <td className="scrim-analytics__loss-cell">{map.losses}</td>
                    <td className="scrim-analytics__draw-cell">{map.draws}</td>
                    <td className={`scrim-analytics__rate-cell ${map.winRate >= 50 ? 'scrim-analytics__rate-cell--good' : 'scrim-analytics__rate-cell--bad'}`}>
                      {map.winRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default ScrimAnalytics
