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
  const [showPastMatches, setShowPastMatches] = useState(false)

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
        
        // Smart BYE detection: If total matches played > actual match records, add BYE weeks
        let results = matchesData.results || []
        if (standingsData.currentSeason) {
          const totalMatchesPlayed = 
            standingsData.currentSeason.wins + 
            standingsData.currentSeason.losses + 
            (standingsData.currentSeason.ties || 0)
          
          const actualMatchCount = results.length
          const byeWeeksCount = totalMatchesPlayed - actualMatchCount
          
          if (byeWeeksCount > 0) {
            // Add BYE weeks to fill the gap
            for (let i = 0; i < byeWeeksCount; i++) {
              results.push({
                id: -1 - i, // Negative ID for fake BYE entries
                date: '', // No date for BYE
                opponent: 'BYE',
                result: undefined,
              })
            }
          }
        }
        
        setRecentResults(results)

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
      timeZoneName: 'short',
    })
  }

  return (
    <section className="mb-8">
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-cyan-500/20 overflow-hidden backdrop-blur-sm hover:border-cyan-500/40 transition-all">
        <div className="p-6 border-b border-cyan-500/20">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              🏆 FaceIt Competitive
            </h2>
            <div className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-md text-sm font-medium text-cyan-300">
              {standing.season}
            </div>
          </div>
        </div>

        {/* Current Season Standings */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-slate-400 uppercase tracking-wide mb-1">Rank</div>
              <div className="text-3xl font-bold text-white">
                {standing.rank} <span className="text-lg text-slate-400 font-normal">of {standing.totalTeams}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400 uppercase tracking-wide mb-1">Record</div>
              <div className="text-3xl font-bold text-white">{standing.record}</div>
            </div>
          </div>
        </div>

        {/* Upcoming Matches */}
        {scheduledMatches.length > 0 && (
          <div className="px-6 pb-6">
            <h3 className="text-lg font-semibold text-white mb-3">📅 Upcoming Matches</h3>
            <div className="space-y-2">
              {scheduledMatches.map((match) => {
                const isBye = match.opponent.toUpperCase() === 'BYE'
                return (
                  <div 
                    key={match.id} 
                    className={`flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border transition-all ${
                      isBye 
                        ? 'border-slate-600/30 opacity-60' 
                        : 'border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm text-slate-400">{formatDate(match.date)}</div>
                      <div className={`font-semibold mt-1 ${isBye ? 'text-slate-500' : 'text-white'}`}>
                        {isBye ? '— BYE Week —' : `vs ${match.opponent}`}
                      </div>
                    </div>
                    {match.roomLink && !isBye && (
                      <a 
                        href={match.roomLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border-2 border-cyan-500/50 hover:border-cyan-500 rounded-md text-sm font-medium text-cyan-300 transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                      >
                        Match Room →
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Past Matches - Collapsible */}
        {recentResults.length > 0 && (
          <div className="px-6 pb-6">
            <button 
              className="flex items-center gap-2 text-lg font-semibold text-white mb-3 hover:text-cyan-300 transition-colors"
              onClick={() => setShowPastMatches(!showPastMatches)}
            >
              <span className="transform transition-transform" style={{ transform: showPastMatches ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              Past Matches ({recentResults.length})
            </button>
            {showPastMatches && (
              <div className="space-y-2">
                {recentResults.map((match) => {
                  const isBye = match.opponent.toUpperCase() === 'BYE'
                  return (
                    <div 
                      key={match.id} 
                      className={`flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border transition-colors ${
                        isBye
                          ? 'border-slate-600/30 opacity-60'
                          : match.result === 'win' 
                            ? 'border-green-500/20 hover:border-green-500/40' 
                            : 'border-red-500/20 hover:border-red-500/40'
                      }`}
                    >
                      <div className="flex-1">
                        {!isBye && match.date && (
                          <div className="text-sm text-slate-400">{formatDate(match.date)}</div>
                        )}
                        <div className={`font-semibold ${isBye ? 'text-slate-500' : match.date ? 'mt-1' : ''} ${isBye ? 'text-slate-500' : 'text-white'}`}>
                          {isBye ? '— BYE Week —' : `vs ${match.opponent}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {!isBye && match.result === 'win' && (
                          <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-md text-sm font-semibold text-green-300">
                            ✓ WIN
                          </span>
                        )}
                        {!isBye && match.result === 'loss' && (
                          <span className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-md text-sm font-semibold text-red-300">
                            ✗ LOSS
                          </span>
                        )}
                        {match.roomLink && !isBye && (
                          <a 
                            href={match.roomLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-md text-xs font-medium text-slate-300 transition-colors"
                          >
                            Room
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Historical Seasons */}
        {historicalSeasons.length > 0 && (
          <div className="px-6 pb-6 border-t border-cyan-500/20 pt-6">
            <button 
              className="flex items-center gap-2 text-lg font-semibold text-white mb-3 hover:text-cyan-300 transition-colors"
              onClick={() => setShowHistory(!showHistory)}
            >
              <span className="transform transition-transform" style={{ transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              Past Seasons ({historicalSeasons.length})
            </button>
            {showHistory && (
              <div className="space-y-2">
                {historicalSeasons.map((season, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                    <span className="text-white font-semibold">{season.season}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white">
                        {season.rank}
                        {season.rank === 1 && '🥇'}
                        {season.rank === 2 && '🥈'}
                        {season.rank === 3 && '🥉'}
                        <span className="text-slate-400 text-sm"> of {season.totalTeams}</span>
                      </span>
                      <span className="text-slate-400 text-sm">({season.record})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
