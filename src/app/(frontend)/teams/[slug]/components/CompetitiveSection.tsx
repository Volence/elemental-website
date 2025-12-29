'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface Standing {
  season: string
  rank: number
  totalTeams: number
  record: string
  wins: number
  losses: number
  ties?: number
  points: number
  division: string
  region: string
  lastSynced?: string
}

interface Match {
  id: number
  date: string
  opponent: string
  result?: 'win' | 'loss' | 'unknown'
  score?: string
  elmtScore?: number
  opponentScore?: number
  roomLink?: string
  faceitRoomId?: string
}

interface CompetitiveSectionProps {
  teamId: number
}

export default function CompetitiveSection({ teamId }: CompetitiveSectionProps) {
  const [standing, setStanding] = useState<Standing | null>(null)
  const [historicalSeasons, setHistoricalSeasons] = useState<Standing[]>([])
  const [scheduledMatches, setScheduledMatches] = useState<Match[]>([])
  const [recentResults, setRecentResults] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        // Fetch standings
        const standingsRes = await fetch(`/api/faceit/standings/${teamId}`)
        if (!standingsRes.ok) throw new Error('Failed to fetch standings')
        const standingsData = await standingsRes.json()
        
        setStanding(standingsData.currentSeason)
        setHistoricalSeasons(standingsData.historicalSeasons || [])

        // Fetch matches
        const matchesRes = await fetch(`/api/faceit/matches/${teamId}`)
        if (!matchesRes.ok) throw new Error('Failed to fetch matches')
        const matchesData = await matchesRes.json()
        
        setScheduledMatches(matchesData.scheduled || [])
        setRecentResults(matchesData.results || [])

      } catch (err: any) {
        console.error('Error fetching FaceIt data:', err)
        setError(err.message || 'Failed to load competitive data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [teamId])

  if (loading) {
    return (
      <div className="competitive-section">
        <div className="competitive-header">
          <h2>🏆 FaceIt Competitive</h2>
        </div>
        <div className="loading">Loading competitive data...</div>
      </div>
    )
  }

  if (error || !standing) {
    return null // Don't show section if no data
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="competitive-section">
      <div className="competitive-header">
        <h2>🏆 FaceIt Competitive</h2>
        <div className="season-badge">{standing.season}</div>
      </div>

      {/* Current Season Standings */}
      <div className="standings-card">
        <div className="standings-header">
          <span className="division-badge">
            {standing.division} {standing.region}
          </span>
        </div>
        <div className="standings-stats">
          <div className="stat">
            <span className="stat-label">Rank</span>
            <span className="stat-value">
              {standing.rank} <span className="stat-secondary">of {standing.totalTeams}</span>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Record</span>
            <span className="stat-value">{standing.record}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Points</span>
            <span className="stat-value">{standing.points}</span>
          </div>
        </div>
      </div>

      {/* Upcoming Matches */}
      {scheduledMatches.length > 0 && (
        <div className="matches-section">
          <h3>📅 Upcoming Matches ({scheduledMatches.length})</h3>
          <div className="matches-list">
            {scheduledMatches.map((match) => (
              <div key={match.id} className="match-card scheduled">
                <div className="match-date">{formatDate(match.date)}</div>
                <div className="match-opponent">vs {match.opponent}</div>
                {match.roomLink && (
                  <a 
                    href={match.roomLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="match-link"
                  >
                    Match Room →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="matches-section">
          <h3>📊 Recent Results</h3>
          <div className="matches-list">
            {recentResults.map((match) => (
              <div key={match.id} className={`match-card result ${match.result}`}>
                <div className="match-date">{formatDate(match.date)}</div>
                <div className="match-opponent">vs {match.opponent}</div>
                <div className="match-result">
                  {match.result === 'win' && <span className="result-badge win">✓ WIN</span>}
                  {match.result === 'loss' && <span className="result-badge loss">✗ LOSS</span>}
                  {match.score && <span className="match-score">{match.score}</span>}
                </div>
                {match.roomLink && (
                  <a 
                    href={match.roomLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="match-link small"
                  >
                    Room
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Seasons */}
      {historicalSeasons.length > 0 && (
        <div className="historical-section">
          <button 
            className="historical-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? '▼' : '▶'} Past Seasons ({historicalSeasons.length})
          </button>
          {showHistory && (
            <div className="historical-list">
              {historicalSeasons.map((season, idx) => (
                <div key={idx} className="historical-item">
                  <span className="historical-season">{season.season}</span>
                  <span className="historical-rank">
                    {season.rank}
                    {season.rank === 1 && '🥇'}
                    {season.rank === 2 && '🥈'}
                    {season.rank === 3 && '🥉'}
                    <span className="historical-secondary"> of {season.totalTeams}</span>
                  </span>
                  <span className="historical-record">({season.record})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .competitive-section {
          margin: 2rem 0;
          padding: 2rem;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .competitive-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }

        .competitive-header h2 {
          margin: 0;
          font-size: 1.75rem;
          color: #fff;
        }

        .season-badge {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-weight: 600;
          color: #fff;
        }

        .standings-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .division-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 600;
          color: #fff;
        }

        .standings-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
        }

        .stat-secondary {
          font-size: 1rem;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.6);
        }

        .matches-section {
          margin-top: 1.5rem;
        }

        .matches-section h3 {
          font-size: 1.25rem;
          color: #fff;
          margin-bottom: 1rem;
        }

        .matches-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .match-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          border-left: 3px solid transparent;
          transition: all 0.2s;
        }

        .match-card:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .match-card.scheduled {
          border-left-color: #3b82f6;
        }

        .match-card.result.win {
          border-left-color: #10b981;
        }

        .match-card.result.loss {
          border-left-color: #ef4444;
        }

        .match-date {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
          min-width: 180px;
        }

        .match-opponent {
          flex: 1;
          font-weight: 600;
          color: #fff;
        }

        .match-result {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .result-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .result-badge.win {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .result-badge.loss {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .match-score {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .match-link {
          padding: 0.5rem 1rem;
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          border-radius: 4px;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 600;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .match-link:hover {
          background: rgba(59, 130, 246, 0.3);
        }

        .match-link.small {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        .historical-section {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .historical-toggle {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.5rem 0;
          transition: color 0.2s;
        }

        .historical-toggle:hover {
          color: #fff;
        }

        .historical-list {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .historical-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }

        .historical-season {
          font-weight: 600;
          color: #fff;
          min-width: 100px;
        }

        .historical-rank {
          color: rgba(255, 255, 255, 0.9);
        }

        .historical-secondary {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.875rem;
        }

        .historical-record {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.875rem;
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: rgba(255, 255, 255, 0.6);
        }

        @media (max-width: 768px) {
          .competitive-section {
            padding: 1.5rem;
          }

          .standings-stats {
            gap: 1rem;
          }

          .match-card {
            flex-direction: column;
            align-items: flex-start;
          }

          .match-date {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  )
}

