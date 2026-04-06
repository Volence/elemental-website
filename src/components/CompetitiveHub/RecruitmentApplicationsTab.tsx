'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Application {
  id: number
  applicantName?: string
  listing?: { title: string } | number
  status?: string
  discordUsername?: string
  createdAt?: string
}

export function RecruitmentApplicationsTab() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page), sort: '-createdAt', depth: '1' })
      if (search) params.set('where[applicantName][contains]', search)
      const res = await fetch(`/api/recruitment-applications?${params}`)
      const data = await res.json()
      setApps(data.docs || [])
      setTotalPages(data.totalPages || 1)
      setTotalDocs(data.totalDocs || 0)
    } catch (err) { console.error('Failed to fetch applications:', err) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'pending': return 'collection-list-tab__badge--scheduled'
      case 'accepted': return 'collection-list-tab__badge--complete'
      case 'rejected': return 'collection-list-tab__badge--cancelled'
      default: return ''
    }
  }

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search applicants..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{totalDocs} applications</span>
          <a href="/admin/collections/recruitment-applications" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Applicant</th><th>Listing</th><th>Discord</th><th>Status</th><th>Applied</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={6} className="collection-list-tab__loading">Loading...</td></tr>)
            : apps.length === 0 ? (<tr><td colSpan={6} className="collection-list-tab__empty">No applications found</td></tr>)
            : apps.map((app) => (
              <tr key={app.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/recruitment-applications/${app.id}`}>{app.applicantName || `App #${app.id}`}</a></td>
                <td>{typeof app.listing === 'object' ? app.listing?.title : '—'}</td>
                <td>{app.discordUsername || '—'}</td>
                <td><span className={`collection-list-tab__badge ${getStatusClass(app.status)}`}>{app.status || 'pending'}</span></td>
                <td>{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}</td>
                <td><a href={`/admin/collections/recruitment-applications/${app.id}`} className="collection-list-tab__edit-link">Edit</a></td>
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
