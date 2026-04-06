'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface SocialPost {
  id: number
  title?: string
  postType?: string
  platform?: string
  status?: string
  scheduledDate?: string
  assignedTo?: { name?: string; email?: string } | number
}

export function SocialPostsTab() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page), sort: '-scheduledDate', depth: '1' })
      if (search) params.set('where[title][contains]', search)
      if (statusFilter) params.set('where[status][equals]', statusFilter)
      const res = await fetch(`/api/social-posts?${params}`)
      const data = await res.json()
      setPosts(data.docs || [])
      setTotalPages(data.totalPages || 1)
      setTotalDocs(data.totalDocs || 0)
    } catch (err) { console.error('Failed to fetch social posts:', err) }
    finally { setLoading(false) }
  }, [page, search, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'Posted': return 'collection-list-tab__badge--complete'
      case 'Approved': case 'Scheduled': return 'collection-list-tab__badge--scheduled'
      case 'Ready for Review': return 'collection-list-tab__badge--active'
      case 'Draft': return ''
      default: return ''
    }
  }

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="collection-list-tab__filter-select">
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Ready for Review">Ready for Review</option>
            <option value="Approved">Approved</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Posted">Posted</option>
          </select>
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{totalDocs} posts</span>
          <a href="/admin/collections/social-posts/create" className="collection-list-tab__btn collection-list-tab__btn--primary"><Plus size={14} /><span>New Post</span></a>
          <a href="/admin/collections/social-posts" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Title</th><th>Type</th><th>Platform</th><th>Scheduled</th><th>Status</th><th>Assigned</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={7} className="collection-list-tab__loading">Loading...</td></tr>)
            : posts.length === 0 ? (<tr><td colSpan={7} className="collection-list-tab__empty">No posts found</td></tr>)
            : posts.map((p) => (
              <tr key={p.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/social-posts/${p.id}`}>{p.title || `Post #${p.id}`}</a></td>
                <td>{p.postType || '—'}</td>
                <td>{p.platform || '—'}</td>
                <td>{p.scheduledDate ? new Date(p.scheduledDate).toLocaleDateString() : '—'}</td>
                <td><span className={`collection-list-tab__badge ${getStatusClass(p.status)}`}>{p.status || 'Draft'}</span></td>
                <td>{typeof p.assignedTo === 'object' ? (p.assignedTo?.name || p.assignedTo?.email || '—') : '—'}</td>
                <td><a href={`/admin/collections/social-posts/${p.id}`} className="collection-list-tab__edit-link">Edit</a></td>
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
