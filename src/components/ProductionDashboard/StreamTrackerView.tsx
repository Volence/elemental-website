'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Radio, Tv, Globe, ChevronDown, ChevronRight } from 'lucide-react'

interface Team {
  id: number
  name: string
  region?: string
  active?: boolean
}

interface MatchDoc {
  id: number
  date: string
  title?: string
  region?: string
  team1Type?: string
  team1Internal?: Team | number | null
  team?: Team | number | null
  stream?: {
    url?: string
    streamedBy?: string
  }
}

interface TeamStreamInfo {
  team: Team
  lastStreamDate: string | null
  totalStreams: number
  daysSinceLastStream: number | null
}

type RegionFilter = 'all' | string

// Color thresholds (days)
const FRESH_THRESHOLD = 14
const STALE_THRESHOLD = 30

function getStalenessColor(daysSince: number | null): { className: string; label: string } {
  if (daysSince === null) return { className: 'stream-tracker__indicator--never', label: 'Never' }
  if (daysSince <= FRESH_THRESHOLD) return { className: 'stream-tracker__indicator--fresh', label: 'Recent' }
  if (daysSince <= STALE_THRESHOLD) return { className: 'stream-tracker__indicator--aging', label: 'Aging' }
  return { className: 'stream-tracker__indicator--stale', label: 'Overdue' }
}

function formatDaysAgo(days: number | null): string {
  if (days === null) return 'Never streamed'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export function StreamTrackerView() {
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<MatchDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)

        // Fetch active teams
        const teamsRes = await fetch('/api/teams?where[active][equals]=true&limit=100&depth=0&sort=name')
        const teamsData = await teamsRes.json()

        // Fetch all matches that were included in a broadcast schedule
        // The real signal is productionWorkflow.includeInSchedule being checked
        const matchesRes = await fetch(
          '/api/matches?limit=500&depth=1&sort=-date' +
          '&where[productionWorkflow.includeInSchedule][equals]=true'
        )
        const matchesData = await matchesRes.json()

        setTeams(teamsData.docs || [])
        setMatches(matchesData.docs || [])
      } catch (err) {
        console.error('Error fetching stream tracker data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Build the team → stream info map
  const teamStreamData = useMemo<TeamStreamInfo[]>(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    return teams.map((team) => {
      // Find all matches where this team was in the broadcast schedule
      const streamedMatches = matches.filter((m) => {
        // Check if team1Internal matches this team
        const team1Id =
          typeof m.team1Internal === 'object' && m.team1Internal !== null
            ? m.team1Internal.id
            : m.team1Internal
        
        // Also check legacy 'team' field
        const legacyTeamId =
          typeof m.team === 'object' && m.team !== null
            ? m.team.id
            : m.team

        return team1Id === team.id || legacyTeamId === team.id
      })

      if (streamedMatches.length === 0) {
        return {
          team,
          lastStreamDate: null,
          totalStreams: 0,
          daysSinceLastStream: null,
        }
      }

      // Sort by date descending, take the most recent
      const sorted = [...streamedMatches].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      const lastDate = new Date(sorted[0].date)
      lastDate.setHours(0, 0, 0, 0)
      const diffMs = now.getTime() - lastDate.getTime()
      const daysSince = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

      return {
        team,
        lastStreamDate: sorted[0].date,
        totalStreams: streamedMatches.length,
        daysSinceLastStream: daysSince,
      }
    })
  }, [teams, matches])

  // Get unique regions
  const regions = useMemo(() => {
    const r = new Set<string>()
    teams.forEach((t) => {
      if (t.region) r.add(t.region)
    })
    return Array.from(r).sort()
  }, [teams])

  // Filter and group by region
  const groupedByRegion = useMemo(() => {
    const filtered =
      regionFilter === 'all'
        ? teamStreamData
        : teamStreamData.filter((t) => t.team.region === regionFilter)

    // Sort: never-streamed first, then by days since (descending = longest ago first)
    const sorted = [...filtered].sort((a, b) => {
      if (a.daysSinceLastStream === null && b.daysSinceLastStream === null) return 0
      if (a.daysSinceLastStream === null) return -1
      if (b.daysSinceLastStream === null) return 1
      return b.daysSinceLastStream - a.daysSinceLastStream
    })

    // Group by region
    const groups: Record<string, TeamStreamInfo[]> = {}
    sorted.forEach((info) => {
      const region = info.team.region || 'Unknown'
      if (!groups[region]) groups[region] = []
      groups[region].push(info)
    })

    return groups
  }, [teamStreamData, regionFilter])

  // Summary stats
  const stats = useMemo(() => {
    const neverStreamed = teamStreamData.filter((t) => t.daysSinceLastStream === null).length
    const overdue = teamStreamData.filter(
      (t) => t.daysSinceLastStream !== null && t.daysSinceLastStream > STALE_THRESHOLD
    ).length
    const totalStreams = teamStreamData.reduce((sum, t) => sum + t.totalStreams, 0)
    return { neverStreamed, overdue, totalStreams, totalTeams: teamStreamData.length }
  }, [teamStreamData])

  const toggleRegion = (region: string) => {
    setCollapsedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(region)) next.delete(region)
      else next.add(region)
      return next
    })
  }

  if (loading) {
    return <div className="production-dashboard__loading">Loading stream data...</div>
  }

  return (
    <div className="stream-tracker">
      {/* Header */}
      <div className="stream-tracker__header">
        <div>
          <h2><Tv size={20} /> Stream Coverage Tracker</h2>
          <p className="stream-tracker__subtitle">
            See which teams haven't been streamed recently so everyone gets fair coverage.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="stream-tracker__stats">
        <div className="stream-tracker__stat">
          <span className="stream-tracker__stat-value">{stats.totalTeams}</span>
          <span className="stream-tracker__stat-label">Active Teams</span>
        </div>
        <div className="stream-tracker__stat">
          <span className="stream-tracker__stat-value stream-tracker__stat-value--total">{stats.totalStreams}</span>
          <span className="stream-tracker__stat-label">Total Streams</span>
        </div>
        <div className="stream-tracker__stat">
          <span className="stream-tracker__stat-value stream-tracker__stat-value--warning">{stats.overdue}</span>
          <span className="stream-tracker__stat-label">Overdue (30d+)</span>
        </div>
        <div className="stream-tracker__stat">
          <span className="stream-tracker__stat-value stream-tracker__stat-value--danger">{stats.neverStreamed}</span>
          <span className="stream-tracker__stat-label">Never Streamed</span>
        </div>
      </div>

      {/* Filter */}
      <div className="stream-tracker__filters">
        <label className="stream-tracker__filter-label">
          <Globe size={14} />
          Region:
        </label>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="stream-tracker__filter-select"
        >
          <option value="all">All Regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Team list by region */}
      <div className="stream-tracker__regions">
        {Object.entries(groupedByRegion).map(([region, teamInfos]) => {
          const isCollapsed = collapsedRegions.has(region)
          return (
            <div key={region} className="stream-tracker__region">
              <button
                className="stream-tracker__region-header"
                onClick={() => toggleRegion(region)}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <span className="stream-tracker__region-name">{region}</span>
                <span className="stream-tracker__region-count">{teamInfos.length} teams</span>
              </button>

              {!isCollapsed && (
                <div className="stream-tracker__team-list">
                  {teamInfos.map((info) => {
                    const staleness = getStalenessColor(info.daysSinceLastStream)
                    return (
                      <div key={info.team.id} className="stream-tracker__team-row">
                        <div className={`stream-tracker__indicator ${staleness.className}`} title={staleness.label}>
                          <Radio size={12} />
                        </div>

                        <div className="stream-tracker__team-name">
                          ELMT {info.team.name}
                        </div>

                        <div className="stream-tracker__last-stream">
                          {info.lastStreamDate
                            ? new Date(info.lastStreamDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </div>

                        <div className="stream-tracker__days-ago">
                          {formatDaysAgo(info.daysSinceLastStream)}
                        </div>

                        <div className="stream-tracker__stream-count">
                          {info.totalStreams} stream{info.totalStreams !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {Object.keys(groupedByRegion).length === 0 && (
          <div className="stream-tracker__empty">
            No teams found for the selected filter.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="stream-tracker__legend">
        <span className="stream-tracker__legend-item">
          <span className="stream-tracker__indicator stream-tracker__indicator--fresh"><Radio size={10} /></span>
          Within {FRESH_THRESHOLD} days
        </span>
        <span className="stream-tracker__legend-item">
          <span className="stream-tracker__indicator stream-tracker__indicator--aging"><Radio size={10} /></span>
          {FRESH_THRESHOLD + 1}–{STALE_THRESHOLD} days
        </span>
        <span className="stream-tracker__legend-item">
          <span className="stream-tracker__indicator stream-tracker__indicator--stale"><Radio size={10} /></span>
          {STALE_THRESHOLD}+ days
        </span>
        <span className="stream-tracker__legend-item">
          <span className="stream-tracker__indicator stream-tracker__indicator--never"><Radio size={10} /></span>
          Never
        </span>
      </div>
    </div>
  )
}
