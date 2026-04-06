'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, Search, CheckCircle2, XCircle } from 'lucide-react'

interface Hero {
  id: number
  name?: string
  role?: string
  active?: boolean
}

export function HeroesTab() {
  const [heroes, setHeroes] = useState<Hero[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100', sort: 'name', depth: '0' })
      if (search) params.set('where[name][contains]', search)
      const res = await fetch(`/api/heroes?${params}`)
      const data = await res.json()
      setHeroes(data.docs || [])
    } catch (err) { console.error('Failed to fetch heroes:', err) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search heroes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{heroes.length} heroes</span>
          <a href="/admin/collections/heroes/create" className="collection-list-tab__btn collection-list-tab__btn--primary"><Plus size={14} /><span>New Hero</span></a>
          <a href="/admin/collections/heroes" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Hero Name</th><th>Role</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={4} className="collection-list-tab__loading">Loading...</td></tr>)
            : heroes.length === 0 ? (<tr><td colSpan={4} className="collection-list-tab__empty">No heroes found</td></tr>)
            : heroes.map((h) => (
              <tr key={h.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/heroes/${h.id}`}>{h.name || `Hero #${h.id}`}</a></td>
                <td>{h.role || '—'}</td>
                <td>{h.active !== false ? <CheckCircle2 size={16} className="collection-list-tab__icon--active" /> : <XCircle size={16} className="collection-list-tab__icon--inactive" />}</td>
                <td><a href={`/admin/collections/heroes/${h.id}`} className="collection-list-tab__edit-link">Edit</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
