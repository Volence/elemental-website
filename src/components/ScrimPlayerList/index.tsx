'use client'

import React, { useState, useEffect } from 'react'

type PlayerSummary = {
  name: string
  team: string
  mapsPlayed: number
  eliminations: number
  deaths: number
  damage: number
  healing: number
  finalBlows: number
  mostPlayedHero: string
}

type SortKey = keyof PlayerSummary
type SortDir = 'asc' | 'desc'

// ── Design tokens (matched to ScrimMapDetail) ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const BG_CARD = '#1a1a2e'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
  overflow: 'hidden',
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

/**
 * Admin view — player directory with career stats.
 * Accessible at /admin/scrim-players.
 */
export default function ScrimPlayerListView() {
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('mapsPlayed')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    fetch('/api/player-stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setPlayers(d.players)
      })
      .catch(() => setError('Failed to fetch player stats'))
      .finally(() => setLoading(false))
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'team' || key === 'mostPlayedHero' ? 'asc' : 'desc')
    }
  }

  const sorted = [...players].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: TEXT_SECONDARY }}>
        Loading player stats…
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ color: RED }}>❌ {error}</p>
      </div>
    )
  }

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'name', label: 'Player', align: 'left' },
    { key: 'team', label: 'Team', align: 'left' },
    { key: 'mostPlayedHero', label: 'Main Hero', align: 'left' },
    { key: 'mapsPlayed', label: 'Maps', align: 'right' },
    { key: 'eliminations', label: 'Elims', align: 'right' },
    { key: 'deaths', label: 'Deaths', align: 'right' },
    { key: 'finalBlows', label: 'FB', align: 'right' },
    { key: 'damage', label: 'Damage', align: 'right' },
    { key: 'healing', label: 'Healing', align: 'right' },
  ]

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: TEXT_PRIMARY, letterSpacing: '-0.5px' }}>
            Player Stats
          </h1>
          <span style={{
            fontSize: '13px',
            color: TEXT_SECONDARY,
          }}>
            {players.length} player{players.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p style={{ color: TEXT_SECONDARY, fontSize: '14px', marginTop: '6px' }}>
          Aggregated career stats across all scrims
        </p>
      </div>

      {/* Table */}
      <div style={CARD_STYLE}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: '14px 16px',
                    textAlign: col.align,
                    cursor: 'pointer',
                    fontWeight: sortKey === col.key ? 700 : 500,
                    color: sortKey === col.key ? CYAN : TEXT_SECONDARY,
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    transition: 'color 0.15s',
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.name}
                onClick={() => window.location.href = `/admin/scrim-player-detail?player=${encodeURIComponent(p.name)}`}
                style={{
                  cursor: 'pointer',
                  borderBottom: `1px solid ${BORDER}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px', fontWeight: 700, color: TEXT_PRIMARY }}>{p.name}</td>
                <td style={{ padding: '12px 16px', color: TEXT_SECONDARY }}>{p.team}</td>
                <td style={{ padding: '12px 16px', color: TEXT_SECONDARY }}>{p.mostPlayedHero}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: CYAN, fontVariantNumeric: 'tabular-nums' }}>{p.mapsPlayed}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.eliminations}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.deaths}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.finalBlows}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(p.damage)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(p.healing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
