'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ExternalLink, Plus, Search } from 'lucide-react'

interface GameMap {
  id: number
  name?: string
  type?: string
}

export function MapsTab() {
  const [maps, setMaps] = useState<GameMap[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100', sort: 'name', depth: '0' })
      if (search) params.set('where[name][contains]', search)
      const res = await fetch(`/api/maps?${params}`)
      const data = await res.json()
      setMaps(data.docs || [])
    } catch (err) { console.error('Failed to fetch maps:', err) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="collection-list-tab">
      <div className="collection-list-tab__toolbar">
        <div className="collection-list-tab__search">
          <Search size={14} />
          <input type="text" placeholder="Search maps..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="collection-list-tab__actions">
          <span className="collection-list-tab__count">{maps.length} maps</span>
          <a href="/admin/collections/maps/create" className="collection-list-tab__btn collection-list-tab__btn--primary"><Plus size={14} /><span>New Map</span></a>
          <a href="/admin/collections/maps" className="collection-list-tab__btn"><ExternalLink size={14} /><span>Full View</span></a>
        </div>
      </div>
      <div className="collection-list-tab__table-wrap">
        <table className="collection-list-tab__table">
          <thead><tr><th>Map Name</th><th>Type</th><th></th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={3} className="collection-list-tab__loading">Loading...</td></tr>)
            : maps.length === 0 ? (<tr><td colSpan={3} className="collection-list-tab__empty">No maps found</td></tr>)
            : maps.map((m) => (
              <tr key={m.id} className="collection-list-tab__row">
                <td className="collection-list-tab__title"><a href={`/admin/collections/maps/${m.id}`}>{m.name || `Map #${m.id}`}</a></td>
                <td>{m.type || '—'}</td>
                <td><a href={`/admin/collections/maps/${m.id}`} className="collection-list-tab__edit-link">Edit</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
