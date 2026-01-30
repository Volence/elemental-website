'use client'

import React, { useState, useEffect } from 'react'

interface ArchivedMatch {
  date: string
  opponent: string
  result: 'win' | 'loss' | 'pending'
  roomLink: string | null
}

interface ArchivedSeason {
  id: number
  seasonName: string
  division: string | null
  region: string | null
  record: string
  wins: number
  losses: number
  rank: number | null
  totalTeams: number | null
  archivedAt: string
  matches: ArchivedMatch[]
}

interface SeasonHistorySectionProps {
  teamId: number
}

export function SeasonHistorySection({ teamId }: SeasonHistorySectionProps) {
  const [seasons, setSeasons] = useState<ArchivedSeason[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set())

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/faceit/history/${teamId}`)
        const data = await res.json()
        setSeasons(data.seasons || [])
      } catch (error) {
        console.error('Failed to fetch season history:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchHistory()
  }, [teamId])

  const toggleSeason = (seasonId: number) => {
    setExpandedSeasons(prev => {
      const next = new Set(prev)
      if (next.has(seasonId)) {
        next.delete(seasonId)
      } else {
        next.add(seasonId)
      }
      return next
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Don't render if no archived seasons
  if (!loading && seasons.length === 0) {
    return null
  }

  return (
    <section id="faceit-history" className="faceit-history">
      <div className="faceit-history__container">
        <h2 className="section-title">
          <span className="section-icon">🏆</span>
          FACEIT History
        </h2>
      
      {loading ? (
        <div className="faceit-history__loading">
          <div className="loading-spinner" />
          <span>Loading history...</span>
        </div>
      ) : (
        <div className="faceit-history__list">
          {seasons.map((season) => {
            const isExpanded = expandedSeasons.has(season.id)
            
            return (
              <div 
                key={season.id} 
                className={`faceit-history__card ${isExpanded ? 'is-expanded' : ''}`}
              >
                <button
                  type="button"
                  className="faceit-history__header"
                  onClick={() => toggleSeason(season.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="faceit-history__arrow">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <span className="faceit-history__name">{season.seasonName}</span>
                  <span className="faceit-history__record">
                    <span className={`faceit-history__wins ${season.wins > season.losses ? 'positive' : ''}`}>
                      {season.wins}W
                    </span>
                    <span className="faceit-history__separator">-</span>
                    <span className={`faceit-history__losses ${season.losses > season.wins ? 'negative' : ''}`}>
                      {season.losses}L
                    </span>
                  </span>
                  {season.rank && (
                    <span className="faceit-history__rank">
                      Rank {season.rank}{season.totalTeams ? `/${season.totalTeams}` : ''}
                    </span>
                  )}
                </button>
                
                {isExpanded && (
                  <div className="faceit-history__matches">
                    {season.matches.length === 0 ? (
                      <p className="faceit-history__no-matches">No match records available</p>
                    ) : (
                      <div className="faceit-history__match-list">
                        {season.matches.map((match, idx) => (
                          <div 
                            key={idx} 
                            className={`faceit-history__match ${match.result}`}
                          >
                            <span className="faceit-history__match-date">
                              {formatDate(match.date)}
                            </span>
                            <span className="faceit-history__match-vs">vs</span>
                            <span className="faceit-history__match-opponent">
                              {match.opponent}
                            </span>
                            <span className={`faceit-history__match-result ${match.result}`}>
                              {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : '?'}
                            </span>
                            {match.roomLink && (
                              <a
                                href={match.roomLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="faceit-history__match-link"
                              >
                                Room
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </section>
  )
}
