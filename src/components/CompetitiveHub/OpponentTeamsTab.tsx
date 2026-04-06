'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface OpponentTeam {
  id: number
  name?: string
  rank?: string
  region?: string
  status?: string
}

export function OpponentTeamsTab() {
  const [teams, setTeams] = useState<OpponentTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page), sort: 'name', depth: '0' })
      if (search) params.set('where[name][contains]', search)
      const res = await fetch(`/api/opponent-teams?${params}`)
      const data = await res.json()
      setTeams(data.docs || [])
      setTotalPages(data.totalPages || 1)
      setTotalDocs(data.totalDocs || 0)
    } catch (err) { console.error('Failed to fetch opponent teams:', err) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'active': return 'collection-list-tab__badge--complete'
      case 'inactive': return 'collection-list-tab__badge--cancelled'
      default: return ''
    }
  }

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search teams..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{totalDocs} teams</span>
          <a href="/admin/collections/opponent-teams/create" className="collection-list-tab__btn collection-list-tab__btn--primary"><Plus size={14} /><span>New Team</span></a>
          <a href="/admin/collections/opponent-teams" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Team Name</th><th>Region</th><th>Rank</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={5} className="collection-list-tab__loading">Loading...</td></tr>)
            : teams.length === 0 ? (<tr><td colSpan={5} className="collection-list-tab__empty">No opponent teams found</td></tr>)
            : teams.map((t) => (
              <tr key={t.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/opponent-teams/${t.id}`}>{t.name || `Team #${t.id}`}</a></td>
                <td>{t.region || '—'}</td>
                <td>{t.rank || '—'}</td>
                <td><span className={`collection-list-tab__badge ${getStatusClass(t.status)}`}>{t.status || '—'}</span></td>
                <td><a href={`/admin/collections/opponent-teams/${t.id}`} className="collection-list-tab__edit-link">Edit</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="collection-list-tab__pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="collection-list-tab__page-btn"><ChevronLeft size={14} /></button>
          <span className="collection-list-tab__page-info">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="collection-list-tab__page-btn"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  )
}
