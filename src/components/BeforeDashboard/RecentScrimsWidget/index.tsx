'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Swords } from 'lucide-react'

interface ScrimMap {
  id: number
  name: string
  mapDataId: number | null
  result: 'win' | 'loss' | 'draw' | null
  score: string | null
}

interface Scrim {
  id: number
  name: string
  date: string
  mapCount: number
  maps: ScrimMap[]
}

/**
 * Shows last 5 scrims with W-L-D colored dots per map.
 */
export default function RecentScrimsWidget() {
  const [scrims, setScrims] = useState<Scrim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/scrims?limit=5', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setScrims((data.scrims ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        date: s.date,
        mapCount: s.mapCount,
        maps: s.maps ?? [],
      }))))
      .catch(() => setScrims([]))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const getRecord = (maps: ScrimMap[]) => {
    const w = maps.filter(m => m.result === 'win').length
    const l = maps.filter(m => m.result === 'loss').length
    const d = maps.filter(m => m.result === 'draw').length
    return { w, l, d }
  }

  const RESULT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    win: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'W' },
    loss: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'L' },
    draw: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'D' },
  }

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget__header">
        <Swords size={16} className="dashboard-widget__header-icon" />
        <h3 className="dashboard-widget__title">Recent Scrims</h3>
        <Link href="/admin/scrims" className="dashboard-widget__view-all">View All →</Link>
      </div>
      <div className="dashboard-widget__body">
        {loading ? (
          <div className="dashboard-widget__loading">Loading…</div>
        ) : scrims.length === 0 ? (
          <div className="dashboard-widget__empty">No scrims uploaded yet</div>
        ) : (
          <div className="dashboard-widget__list">
            {scrims.map(s => {
              const { w, l, d } = getRecord(s.maps)
              const firstMapId = s.maps[0]?.mapDataId
              const href = firstMapId ? `/admin/scrim-map?mapId=${firstMapId}` : '/admin/scrims'
              return (
                <Link key={s.id} href={href} className="dashboard-widget__row">
                  <div className="dashboard-widget__row-date">
                    <span className="dashboard-widget__row-day">{formatDate(s.date)}</span>
                    <span className="dashboard-widget__row-time">{s.mapCount} maps</span>
                  </div>
                  <div className="dashboard-widget__row-content">
                    <span className="dashboard-widget__row-title">{s.name}</span>
                    <span className="dashboard-widget__row-meta">
                      <span className="dashboard-widget__record">{w}-{l}-{d}</span>
                      <span className="dashboard-widget__result-dots">
                        {s.maps.map((m, i) => {
                          const rc = m.result ? RESULT_COLORS[m.result] : null
                          return (
                            <span
                              key={i}
                              className="dashboard-widget__result-dot"
                              style={{
                                background: rc?.bg ?? 'rgba(100,116,139,0.15)',
                                color: rc?.text ?? '#64748b',
                              }}
                              title={`${m.name}: ${m.score ?? '?'}`}
                            >
                              {rc?.label ?? '?'}
                            </span>
                          )
                        })}
                      </span>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
