'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Search, ChevronLeft, ChevronRight, CheckCircle2, PauseCircle, Trash2 } from 'lucide-react'

interface WatchedThread {
  id: number
  threadName?: string
  channelName?: string
  status?: string
  lastKeptAliveAt?: string
  keepAliveCount?: number
  createdAt?: string
}

const WatchedThreadsTab: React.FC = () => {
  const [threads, setThreads] = useState<WatchedThread[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page), sort: '-lastKeptAliveAt', depth: '0' })
      if (search) params.set('where[threadName][contains]', search)
      const res = await fetch(`/api/watched-threads?${params}`)
      const data = await res.json()
      setThreads(data.docs || [])
      setTotalPages(data.totalPages || 1)
      setTotalDocs(data.totalDocs || 0)
    } catch (err) { console.error('Failed to fetch watched threads:', err) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 size={16} className="collection-list-tab__icon--active" />
      case 'paused': return <PauseCircle size={16} style={{ color: '#f59e0b' }} />
      case 'deleted': return <Trash2 size={16} style={{ color: '#ef4444' }} />
      default: return <CheckCircle2 size={16} className="collection-list-tab__icon--active" />
    }
  }

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search threads..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{totalDocs} threads</span>
          <a href="/admin/collections/watched-threads" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Thread Name</th><th>Channel</th><th>Status</th><th>Keep-alive Count</th><th>Last Alive</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={6} className="collection-list-tab__loading">Loading...</td></tr>)
            : threads.length === 0 ? (<tr><td colSpan={6} className="collection-list-tab__empty">No watched threads found</td></tr>)
            : threads.map((t) => (
              <tr key={t.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/watched-threads/${t.id}`}>{t.threadName || `Thread #${t.id}`}</a></td>
                <td>{t.channelName || '—'}</td>
                <td>{getStatusIcon(t.status)} {t.status || 'active'}</td>
                <td>{t.keepAliveCount ?? 0}</td>
                <td>{t.lastKeptAliveAt ? new Date(t.lastKeptAliveAt).toLocaleDateString() : '—'}</td>
                <td><a href={`/admin/collections/watched-threads/${t.id}`} className="collection-list-tab__edit-link">Edit</a></td>
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

export default WatchedThreadsTab
