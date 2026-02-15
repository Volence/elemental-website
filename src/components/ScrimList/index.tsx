'use client'

import React, { useState, useEffect, useCallback } from 'react'

type ScrimMap = {
  id: number
  name: string
  mapDataId: number | null
}

type Scrim = {
  id: number
  name: string
  date: string
  createdAt: string
  creatorEmail: string
  mapCount: number
  maps: ScrimMap[]
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Admin view — list of uploaded scrims.
 * Accessible at /admin/scrims.
 */
export default function ScrimListView() {
  const [scrims, setScrims] = useState<Scrim[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchScrims = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scrims?page=${page}&limit=10`)
      const data = await res.json()
      setScrims(data.scrims)
      setPagination(data.pagination)
    } catch {
      setScrims([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchScrims()
  }, [fetchScrims])

  const handleDelete = async (scrimId: number) => {
    if (!confirm('Delete this scrim and all its data? This cannot be undone.')) return
    setDeleting(scrimId)
    try {
      await fetch(`/api/scrims?id=${scrimId}`, { method: 'DELETE' })
      fetchScrims(pagination?.page)
    } catch {
      alert('Failed to delete scrim')
    }
    setDeleting(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Scrim Analytics</h1>
          <p style={{ color: 'var(--theme-text-secondary, #888)', fontSize: '14px', marginTop: '4px' }}>
            {pagination ? `${pagination.total} scrim${pagination.total !== 1 ? 's' : ''} uploaded` : 'Loading…'}
          </p>
        </div>
        <a
          href="/admin/scrim-upload"
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            background: 'var(--theme-success-500, #22c55e)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          + Upload Scrim
        </a>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--theme-text-secondary, #888)' }}>
          Loading scrims…
        </div>
      ) : scrims.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 0',
          color: 'var(--theme-text-secondary, #888)',
          border: '1px dashed var(--theme-elevation-300, #555)',
          borderRadius: '12px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
          <p style={{ fontWeight: 500 }}>No scrims uploaded yet</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Upload ScrimTime log files to get started</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scrims.map((scrim) => (
              <div
                key={scrim.id}
                style={{
                  background: 'var(--theme-elevation-50, #222)',
                  borderRadius: '8px',
                  border: '1px solid var(--theme-elevation-150, #333)',
                  overflow: 'hidden',
                }}
              >
                {/* Scrim header row */}
                <div
                  onClick={() => setExpandedId(expandedId === scrim.id ? null : scrim.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.5 }}>
                      {expandedId === scrim.id ? '▼' : '▶'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{scrim.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--theme-text-secondary, #888)', marginTop: '2px' }}>
                        {formatDate(scrim.date)} · {scrim.mapCount} map{scrim.mapCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: 'var(--theme-elevation-150, #333)',
                      color: 'var(--theme-text-secondary, #888)',
                    }}>
                      {scrim.creatorEmail.split('@')[0]}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(scrim.id) }}
                      disabled={deleting === scrim.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--theme-error-500, #ef4444)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        opacity: deleting === scrim.id ? 0.5 : 1,
                      }}
                      title="Delete scrim"
                    >
                      {deleting === scrim.id ? '…' : '🗑'}
                    </button>
                  </div>
                </div>

                {/* Expanded map list */}
                {expandedId === scrim.id && (
                  <div style={{
                    borderTop: '1px solid var(--theme-elevation-150, #333)',
                    padding: '8px 16px 12px',
                  }}>
                    {scrim.maps.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--theme-text-secondary, #888)', padding: '8px 0' }}>
                        No maps found
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {scrim.maps.map((map) => (
                          <a
                            key={map.id}
                            href={map.mapDataId ? `/admin/scrim-map?mapId=${map.mapDataId}` : '#'}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: 'var(--theme-elevation-100, #2a2a2a)',
                              textDecoration: 'none',
                              color: 'inherit',
                              fontSize: '13px',
                              transition: 'background 0.15s',
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>{map.name}</span>
                            {map.mapDataId ? (
                              <span style={{ fontSize: '12px', color: 'var(--theme-success-500, #22c55e)' }}>
                                View Stats →
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--theme-text-secondary, #888)' }}>
                                No data
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '24px',
            }}>
              <button
                onClick={() => fetchScrims(pagination.page - 1)}
                disabled={pagination.page <= 1}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--theme-elevation-300, #555)',
                  background: 'transparent',
                  color: 'var(--theme-text, #fff)',
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: pagination.page <= 1 ? 0.4 : 1,
                  fontSize: '13px',
                }}
              >
                ← Previous
              </button>
              <span style={{
                padding: '6px 14px',
                fontSize: '13px',
                color: 'var(--theme-text-secondary, #888)',
                display: 'flex',
                alignItems: 'center',
              }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchScrims(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--theme-elevation-300, #555)',
                  background: 'transparent',
                  color: 'var(--theme-text, #fff)',
                  cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                  opacity: pagination.page >= pagination.totalPages ? 0.4 : 1,
                  fontSize: '13px',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
