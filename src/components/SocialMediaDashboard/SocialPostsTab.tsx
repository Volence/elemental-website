'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { DialogA11y } from '@/admin-kit'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { ExternalLink, Search, ChevronLeft, ChevronRight, X, Info } from 'lucide-react'
import { getPostTypeColor } from '@/utilities/socialPostTypes'

interface SocialPost {
  id: number
  title?: string
  content?: string
  postType?: string
  platform?: string
  status?: string
  scheduledDate?: string
  notes?: string
  assignedTo?: { name?: string; email?: string } | number
  approvedBy?: { name?: string; email?: string } | number
}

const personName = (p: SocialPost['assignedTo']) =>
  typeof p === 'object' && p ? p.name || p.email || '-' : '-'

/**
 * Read-only archive of the old social-posts collection. New posts are planned
 * as workboard tasks and show up on the calendar.
 */
export function SocialPostsTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'staff-manager'
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<SocialPost | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page), sort: '-scheduledDate', depth: '1' })
      if (search) params.set('where[title][contains]', search)
      if (statusFilter) params.set('where[status][equals]', statusFilter)
      const res = await fetch(`/api/social-posts?${params}`, { credentials: 'include' })
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
      default: return ''
    }
  }

  return (
    <div className="collection-list-tab">
      <div className="social-posts-archive-note">
        <Info size={14} />
        <span>
          Posts are now planned on the <strong>Calendar</strong> and <strong>Workboard</strong> as tasks. This is the read-only archive of posts created with the old form.
        </span>
      </div>
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search past posts..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
          {isAdmin && (
            <Link href="/admin/collections/social-posts" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Admin View</span></Link>
          )}
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Title</th><th>Type</th><th>Platform</th><th>Scheduled</th><th>Status</th><th>Assigned</th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={6} className="collection-list-tab__loading">Loading...</td></tr>)
            : posts.length === 0 ? (<tr><td colSpan={6} className="collection-list-tab__empty">No past posts</td></tr>)
            : posts.map((p) => (
              <tr key={p.id} className="collection-list-tab__row" onClick={() => setSelected(p)} style={{ cursor: 'pointer' }}>
                <td className="collection-list-tab__title"><a href="#" onClick={(e) => { e.preventDefault(); setSelected(p) }}>{p.title || `Post #${p.id}`}</a></td>
                <td>
                  {p.postType ? (
                    <span className="social-posts-archive__type" style={{ color: getPostTypeColor(p.postType), borderColor: getPostTypeColor(p.postType) }}>{p.postType}</span>
                  ) : '-'}
                </td>
                <td>{p.platform || '-'}</td>
                <td>{p.scheduledDate ? new Date(p.scheduledDate).toLocaleDateString() : '-'}</td>
                <td><span className={`collection-list-tab__badge ${getStatusClass(p.status)}`}>{p.status || 'Draft'}</span></td>
                <td>{personName(p.assignedTo)}</td>
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

      {selected && (
        <div className="workboard-modal-overlay" onClick={() => setSelected(null)} role="presentation">
<DialogA11y onClose={() => setSelected(null)} />
          <div
 className="workboard-modal"
 role="dialog"
 aria-modal="true"
 onClick={(e) => e.stopPropagation()}>
            <div className="workboard-modal__header">
              <div className="workboard-modal__header-title">
                <h2>{selected.title || `Post #${selected.id}`}</h2>
                <span className="workboard-modal__request-badge">Archived post (read-only)</span>
              </div>
              <button className="workboard-modal__close" onClick={() => setSelected(null)}><X size={16} /></button>
            </div>
            <div className="workboard-modal__form">
              <div className="workboard-modal__row">
                <div className="workboard-modal__field"><label>Type</label><div className="digest-modal__readonly">{selected.postType || '-'}</div></div>
                <div className="workboard-modal__field"><label>Platform</label><div className="digest-modal__readonly">{selected.platform || '-'}</div></div>
                <div className="workboard-modal__field"><label>Status</label><div className="digest-modal__readonly">{selected.status || '-'}</div></div>
              </div>
              <div className="workboard-modal__row">
                <div className="workboard-modal__field"><label>Scheduled</label><div className="digest-modal__readonly">{selected.scheduledDate ? new Date(selected.scheduledDate).toLocaleString() : '-'}</div></div>
                <div className="workboard-modal__field"><label>Assigned To</label><div className="digest-modal__readonly">{personName(selected.assignedTo)}</div></div>
                <div className="workboard-modal__field"><label>Approved By</label><div className="digest-modal__readonly">{personName(selected.approvedBy)}</div></div>
              </div>
              <div className="workboard-modal__field">
                <label>Content</label>
                <div className="digest-modal__readonly digest-modal__readonly--multiline">{selected.content?.trim() || 'No content'}</div>
              </div>
              {selected.notes && (
                <div className="workboard-modal__field">
                  <label>Notes</label>
                  <div className="digest-modal__readonly digest-modal__readonly--multiline">{selected.notes}</div>
                </div>
              )}
              <div className="workboard-modal__actions">
                <div />
                <div className="workboard-modal__primary-actions">
                  {isAdmin && (
                    <Link href={`/admin/collections/social-posts/${selected.id}`} className="workboard-modal__btn workboard-modal__btn--secondary">
                      <ExternalLink size={12} /> Open in Admin
                    </Link>
                  )}
                  <button type="button" className="workboard-modal__btn workboard-modal__btn--primary" onClick={() => setSelected(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
