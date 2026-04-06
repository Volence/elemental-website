'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react'

interface Listing {
  id: number
  title?: string
  team?: { name: string } | number
  role?: string
  status?: string
  updatedAt?: string
}

export function RecruitmentListingsTab() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [search, setSearch] = useState('')
  const limit = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page), sort: '-updatedAt', depth: '1' })
      if (search) params.set('where[title][contains]', search)
      const res = await fetch(`/api/recruitment-listings?${params}`)
      const data = await res.json()
      setListings(data.docs || [])
      setTotalPages(data.totalPages || 1)
      setTotalDocs(data.totalDocs || 0)
    } catch (err) { console.error('Failed to fetch listings:', err) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search listings..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{totalDocs} listings</span>
          <a href="/admin/collections/recruitment-listings/create" className="collection-list-tab__btn collection-list-tab__btn--primary"><Plus size={14} /><span>New Listing</span></a>
          <a href="/admin/collections/recruitment-listings" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Title</th><th>Team</th><th>Role</th><th>Status</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={6} className="collection-list-tab__loading">Loading...</td></tr>)
            : listings.length === 0 ? (<tr><td colSpan={6} className="collection-list-tab__empty">No listings found</td></tr>)
            : listings.map((item) => (
              <tr key={item.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/recruitment-listings/${item.id}`}>{item.title || `Listing #${item.id}`}</a></td>
                <td>{typeof item.team === 'object' ? item.team?.name : '—'}</td>
                <td>{item.role || '—'}</td>
                <td><span className={`collection-list-tab__badge collection-list-tab__badge--${item.status || 'draft'}`}>{item.status || 'draft'}</span></td>
                <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td>
                <td><a href={`/admin/collections/recruitment-listings/${item.id}`} className="collection-list-tab__edit-link">Edit</a></td>
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
