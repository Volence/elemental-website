'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface ScoutReport {
  id: number
  title?: string
  opponentTeam?: { name: string } | number
  author?: { name: string } | number
  status?: string
  updatedAt?: string
}

export function ScoutReportsTab() {
  const [reports, setReports] = useState<ScoutReport[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page), sort: '-updatedAt', depth: '1' })
      if (search) params.set('where[title][contains]', search)
      const res = await fetch(`/api/scout-reports?${params}`)
      const data = await res.json()
      setReports(data.docs || [])
      setTotalPages(data.totalPages || 1)
      setTotalDocs(data.totalDocs || 0)
    } catch (err) { console.error('Failed to fetch scout reports:', err) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search reports..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{totalDocs} reports</span>
          <a href="/admin/collections/scout-reports/create" className="collection-list-tab__btn collection-list-tab__btn--primary"><Plus size={14} /><span>New Report</span></a>
          <a href="/admin/collections/scout-reports" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Title</th><th>Opponent</th><th>Author</th><th>Status</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={6} className="collection-list-tab__loading">Loading...</td></tr>)
            : reports.length === 0 ? (<tr><td colSpan={6} className="collection-list-tab__empty">No scout reports found</td></tr>)
            : reports.map((r) => (
              <tr key={r.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/scout-reports/${r.id}`}>{r.title || `Report #${r.id}`}</a></td>
                <td>{typeof r.opponentTeam === 'object' ? r.opponentTeam?.name : '—'}</td>
                <td>{typeof r.author === 'object' ? r.author?.name : '—'}</td>
                <td><span className={`collection-list-tab__badge`}>{r.status || 'draft'}</span></td>
                <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</td>
                <td><a href={`/admin/collections/scout-reports/${r.id}`} className="collection-list-tab__edit-link">Edit</a></td>
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
