'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react'

interface Match {
  id: number
  title?: string
  date?: string
  status?: string
  region?: string
  team1Internal?: { name: string } | number
  team1External?: string
  team2Internal?: { name: string } | number
  team2External?: string
  team?: { name: string } | number
  opponent?: string
  matchType?: string
}

export function MatchesListTab() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const limit = 20

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
        sort: '-date',
        depth: '1',
      })

      if (statusFilter !== 'all') {
        params.set('where[status][equals]', statusFilter)
      }

      if (search) {
        params.set('where[title][contains]', search)
      }

      const res = await fetch(`/api/matches?${params}`)
      const data = await res.json()
      setMatches(data.docs || [])
      setTotalPages(data.totalPages || 1)
      setTotalDocs(data.totalDocs || 0)
    } catch (err) {
      console.error('Failed to fetch matches:', err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, search])

  const getTeamName = (match: Match, side: 'team1' | 'team2'): string => {
    if (side === 'team1') {
      if (match.team1Internal && typeof match.team1Internal === 'object') return match.team1Internal.name
      if (match.team1External) return match.team1External
      if (match.team && typeof match.team === 'object') return match.team.name
      return '—'
    }
    if (match.team2Internal && typeof match.team2Internal === 'object') return match.team2Internal.name
    if (match.team2External) return match.team2External
    if (match.opponent) return match.opponent
    return '—'
  }

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'scheduled': return 'collection-list-tab__badge--scheduled'
      case 'live': return 'collection-list-tab__badge--live'
      case 'complete': return 'collection-list-tab__badge--complete'
      case 'cancelled': return 'collection-list-tab__badge--cancelled'
      default: return ''
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="collection-list-tab">
      {/* Toolbar */}
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search matches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="collection-list-tab__filters">
          <Filter size={14} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="complete">Complete</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{totalDocs} matches</span>
          <a
            href="/admin/collections/matches/create"
            className="collection-list-tab__btn collection-list-tab__btn--primary"
          >
            <Plus size={14} />
            <span>New Match</span>
          </a>
          <a
            href="/admin/collections/matches"
            className="collection-list-tab__btn"
          >
            <ExternalLink size={14} />
            <span>Full View</span>
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Date</th>
              <th>Team 1</th>
              <th>Team 2</th>
              <th>Region</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="collection-list-tab__loading">Loading...</td>
              </tr>
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={7} className="collection-list-tab__empty">No matches found</td>
              </tr>
            ) : (
              matches.map((match) => (
                <tr key={match.id} className="collection-list-tab__row">
                  <td className="collection-list-tab__title">
                    <a href={`/admin/collections/matches/${match.id}`}>
                      {match.title || `Match #${match.id}`}
                    </a>
                  </td>
                  <td>{formatDate(match.date)}</td>
                  <td>{getTeamName(match, 'team1')}</td>
                  <td>{getTeamName(match, 'team2')}</td>
                  <td>{match.region || '—'}</td>
                  <td>
                    <span className={`collection-list-tab__badge ${getStatusBadgeClass(match.status)}`}>
                      {match.status || 'unknown'}
                    </span>
                  </td>
                  <td>
                    <a
                      href={`/admin/collections/matches/${match.id}`}
                      className="collection-list-tab__edit-link"
                    >
                      Edit
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="collection-list-tab__pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="collection-list-tab__page-btn"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="collection-list-tab__page-info">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="collection-list-tab__page-btn"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
