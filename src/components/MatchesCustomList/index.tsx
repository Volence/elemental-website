'use client'

import React, { useState, useEffect } from 'react'
import { useConfig } from '@payloadcms/ui'
import Link from 'next/link'

export default function MatchesCustomList() {
  const config = useConfig()
  const adminRoute = config?.routes?.admin || '/admin'
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([])
  const [completedMatches, setCompletedMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [upcomingTotal, setUpcomingTotal] = useState(0)
  const [completedTotal, setCompletedTotal] = useState(0)
  const [completedPage, setCompletedPage] = useState(1)
  const [completedTotalPages, setCompletedTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [broadcastFilter, setBroadcastFilter] = useState<string>('all')
  const [teams, setTeams] = useState<any[]>([])
  
  const COMPLETED_PAGE_SIZE = 20

  useEffect(() => {
    fetchTeams()
    fetchMatches()
  }, [])
  
  useEffect(() => {
    setCompletedPage(1)
    fetchMatches()
  }, [searchTerm, teamFilter, statusFilter, broadcastFilter])
  
  useEffect(() => {
    fetchMatches()
  }, [completedPage])
  
  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams?limit=100&depth=0')
      const data = await response.json()
      setTeams(data.docs || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const fetchMatches = async () => {
    try {
      setLoading(true)
      
      let upcomingQuery = 'where[status][equals]=scheduled&sort=date&limit=100&depth=1'
      const offset = (completedPage - 1) * COMPLETED_PAGE_SIZE
      let completedQuery = `where[status][in][0]=complete&where[status][in][1]=cancelled&sort=-date&limit=${COMPLETED_PAGE_SIZE}&offset=${offset}&depth=1`
      
      if (teamFilter && teamFilter !== 'all') {
        upcomingQuery += `&where[team][equals]=${teamFilter}`
        completedQuery += `&where[team][equals]=${teamFilter}`
      }
      
      if (searchTerm && searchTerm.trim() !== '') {
        const searchParam = encodeURIComponent(searchTerm.trim())
        upcomingQuery += `&where[or][0][title][contains]=${searchParam}&where[or][1][opponent][contains]=${searchParam}`
        completedQuery += `&where[or][0][title][contains]=${searchParam}&where[or][1][opponent][contains]=${searchParam}`
      }
      
      if (broadcastFilter === 'broadcasted') {
        upcomingQuery += `&where[or][0][streamLink][exists]=true&where[or][1][vod][exists]=true`
        completedQuery += `&where[or][0][streamLink][exists]=true&where[or][1][vod][exists]=true`
      } else if (broadcastFilter === 'not-broadcasted') {
        upcomingQuery += `&where[streamLink][exists]=false&where[vod][exists]=false`
        completedQuery += `&where[streamLink][exists]=false&where[vod][exists]=false`
      }
      
      if (statusFilter === 'scheduled' || statusFilter === 'all') {
        const upcomingRes = await fetch(`/api/matches?${upcomingQuery}`)
        const upcomingData = await upcomingRes.json()
        setUpcomingMatches(upcomingData.docs || [])
        setUpcomingTotal(upcomingData.totalDocs || 0)
      } else {
        setUpcomingMatches([])
        setUpcomingTotal(0)
      }
      
      if (statusFilter === 'complete' || statusFilter === 'cancelled' || statusFilter === 'all') {
        const completedRes = await fetch(`/api/matches?${completedQuery}`)
        const completedData = await completedRes.json()
        setCompletedMatches(completedData.docs || [])
        setCompletedTotal(completedData.totalDocs || 0)
        setCompletedTotalPages(Math.ceil((completedData.totalDocs || 0) / COMPLETED_PAGE_SIZE))
      } else {
        setCompletedMatches([])
        setCompletedTotal(0)
        setCompletedTotalPages(1)
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getTeamName = (team: any) => {
    if (!team) return 'Unknown'
    if (typeof team === 'number') return `Team #${team}`
    return team.name || 'Unknown'
  }
  
  const isBroadcasted = (match: any) => {
    return !!(match.streamLink || match.vod)
  }

  if (loading) {
    return <div className="matches-custom-list__loading">Loading matches...</div>
  }

  const hasActiveFilters = searchTerm || teamFilter !== 'all' || statusFilter !== 'all' || broadcastFilter !== 'all'

  return (
    <div className="matches-custom-list">
      {/* Breadcrumbs */}
      <nav style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--theme-elevation-700)' }}>
        <a href={adminRoute} style={{ color: 'inherit', textDecoration: 'none' }}>Dashboard</a>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <span style={{ color: 'var(--theme-text)', fontWeight: '600' }}>Matches</span>
      </nav>

      {/* Search and Filter Controls */}
      <div className="matches-custom-list__filters">
        <h3>🔍 Search & Filter</h3>
        
        <div className="matches-custom-list__filters-grid">
          <div className="matches-custom-list__filters-field">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or opponent..."
            />
          </div>
          
          <div className="matches-custom-list__filters-field">
            <label>Team</label>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All Teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          
          <div className="matches-custom-list__filters-field">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled Only</option>
              <option value="complete">Complete Only</option>
              <option value="cancelled">Cancelled Only</option>
            </select>
          </div>
          
          <div className="matches-custom-list__filters-field">
            <label>Broadcast</label>
            <select value={broadcastFilter} onChange={(e) => setBroadcastFilter(e.target.value)}>
              <option value="all">All Matches</option>
              <option value="broadcasted">Broadcasted Only</option>
              <option value="not-broadcasted">Not Broadcasted</option>
            </select>
          </div>
        </div>
        
        {hasActiveFilters && (
          <div className="matches-custom-list__filters-active">
            <span>Active filters:</span>
            {searchTerm && <span className="matches-custom-list__filters-active-badge">Search: "{searchTerm}"</span>}
            {teamFilter !== 'all' && (
              <span className="matches-custom-list__filters-active-badge">
                Team: {teams.find(t => t.id.toString() === teamFilter)?.name || teamFilter}
              </span>
            )}
            {statusFilter !== 'all' && <span className="matches-custom-list__filters-active-badge">Status: {statusFilter}</span>}
            {broadcastFilter !== 'all' && (
              <span className="matches-custom-list__filters-active-badge">
                Broadcast: {broadcastFilter === 'broadcasted' ? 'Broadcasted Only' : 'Not Broadcasted'}
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('')
                setTeamFilter('all')
                setStatusFilter('all')
                setBroadcastFilter('all')
              }}
              className="matches-custom-list__filters-active-clear"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      
      {/* Upcoming Matches Section */}
      {(statusFilter === 'scheduled' || statusFilter === 'all') && (
        <div className="matches-custom-list__section">
          <div className="matches-custom-list__section-header">
            <h2>
              📅 Upcoming Matches
              <span className="badge">{upcomingTotal}</span>
            </h2>
            <Link href={`${adminRoute}/collections/matches/create`} className="create-button">
              + Create New
            </Link>
          </div>
          
          {upcomingMatches.length === 0 ? (
            <p className="matches-custom-list__empty">No upcoming matches scheduled</p>
          ) : (
            <div className="matches-custom-list__grid">
              {upcomingMatches.map((match, index) => (
                <Link
                  key={`upcoming-${match.id}-${index}`}
                  href={`${adminRoute}/collections/matches/${match.id}`}
                  className="matches-custom-list__card"
                >
                  <div className="matches-custom-list__card-info">
                    <div className="matches-custom-list__card-info-title">
                      {match.title || 'Untitled Match'}
                    </div>
                  </div>
                  <div className="matches-custom-list__card-date">
                    {formatDate(match.date)}
                  </div>
                  <div className="matches-custom-list__card-badges">
                    <span className="status-badge status-badge--scheduled">Scheduled</span>
                    {isBroadcasted(match) && (
                      <span className="broadcast-badge">
                        📺 {match.vod ? 'VOD' : 'STREAMED'}
                      </span>
                    )}
                  </div>
                  <div className="matches-custom-list__card-arrow">→</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed/Cancelled Matches Section */}
      {(statusFilter === 'complete' || statusFilter === 'cancelled' || statusFilter === 'all') && (
        <div className="matches-custom-list__section">
          <div className="matches-custom-list__section-header">
            <h2>
              📦 Completed & Cancelled
              <span className="badge">{completedTotal}</span>
            </h2>
          </div>
          
          {completedMatches.length === 0 ? (
            <p className="matches-custom-list__empty">No completed or cancelled matches</p>
          ) : (
            <>
              <div className="matches-custom-list__grid">
                {completedMatches.map((match, index) => (
                  <Link
                    key={`completed-${match.id}-${index}`}
                    href={`${adminRoute}/collections/matches/${match.id}`}
                    className="matches-custom-list__card matches-custom-list__card--completed"
                  >
                    <div className="matches-custom-list__card-info">
                      <div className="matches-custom-list__card-info-title">
                        {match.title || 'Untitled Match'}
                      </div>
                    </div>
                    <div className="matches-custom-list__card-date">
                      {formatDate(match.date)}
                    </div>
                    <div className="matches-custom-list__card-badges">
                      <span className={`status-badge status-badge--${match.status}`}>
                        {match.status}
                      </span>
                      {isBroadcasted(match) && (
                        <span className="broadcast-badge">
                          📺 {match.vod ? 'VOD' : 'STREAMED'}
                        </span>
                      )}
                    </div>
                    <div className="matches-custom-list__card-arrow">→</div>
                  </Link>
                ))}
              </div>
            </>
          )}
          
          {/* Pagination Controls */}
          {completedTotalPages > 1 && (
            <div className="matches-custom-list__pagination">
              <button
                onClick={() => setCompletedPage(prev => Math.max(1, prev - 1))}
                disabled={completedPage === 1}
              >
                ← Previous
              </button>
              
              {completedPage > 3 && (
                <>
                  <button onClick={() => setCompletedPage(1)}>1</button>
                  <span className="matches-custom-list__pagination-ellipsis">...</span>
                </>
              )}
              
              {Array.from({ length: completedTotalPages }, (_, i) => i + 1)
                .filter(page => Math.abs(page - completedPage) <= 2)
                .map(page => (
                  <button
                    key={page}
                    onClick={() => setCompletedPage(page)}
                    className={page === completedPage ? 'matches-custom-list__pagination button--active' : ''}
                  >
                    {page}
                  </button>
                ))}
              
              {completedPage < completedTotalPages - 2 && (
                <>
                  <span className="matches-custom-list__pagination-ellipsis">...</span>
                  <button onClick={() => setCompletedPage(completedTotalPages)}>
                    {completedTotalPages}
                  </button>
                </>
              )}
              
              <button
                onClick={() => setCompletedPage(prev => Math.min(completedTotalPages, prev + 1))}
                disabled={completedPage === completedTotalPages}
              >
                Next →
              </button>
            </div>
          )}
          
          {completedTotal > 0 && (
            <p className="matches-custom-list__pagination-info">
              Page {completedPage} of {completedTotalPages} • Showing {((completedPage - 1) * COMPLETED_PAGE_SIZE) + 1}-{Math.min(completedPage * COMPLETED_PAGE_SIZE, completedTotal)} of {completedTotal}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
