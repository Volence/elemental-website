'use client'

import React, { useState, useEffect } from 'react'

// ── Types ──

type PlayerInfo = {
  name: string
  team: string
  mostPlayedHero: string
  mapsPlayed: number
}

type CareerStats = {
  eliminations: number
  deaths: number
  damage: number
  healing: number
  finalBlows: number
  avgFirstPickPct: number
  avgFirstDeathPct: number
}

type HeroPoolEntry = {
  hero: string
  mapsPlayed: number
  totalTime: number
  totalElims: number
  totalDeaths: number
  totalDamage: number
  totalHealing: number
  totalFB: number
}

type MapEntry = {
  mapDataId: number
  mapName: string
  mapType: string
  scrimName: string
  scrimDate: string
  hero: string
  eliminations: number
  finalBlows: number
  deaths: number
  damage: number
  healing: number
  firstPickPct: number
  firstDeathPct: number
  fletaPct: number
  ultCharge: number
  ultHold: number
  kPerUlt: number
  drought: number
}

type PlayerData = {
  player: PlayerInfo
  career: CareerStats
  heroPool: HeroPoolEntry[]
  maps: MapEntry[]
}

type MapSortKey = keyof MapEntry
type SortDir = 'asc' | 'desc'

// ── Design tokens (same as ScrimMapDetail) ──
const CYAN = '#06b6d4'
const CYAN_DIM = 'rgba(6, 182, 212, 0.12)'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const BG_CARD = '#1a1a2e'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
  padding: '20px',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: TEXT_SECONDARY,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  fontWeight: 600,
  marginBottom: '8px',
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Admin view — individual player analytics dashboard.
 * Accessible at /admin/scrim-player?player=Name.
 */
export default function ScrimPlayerDetailView() {
  const [data, setData] = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapSortKey, setMapSortKey] = useState<MapSortKey>('scrimDate')
  const [mapSortDir, setMapSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const player = params.get('player')
    if (!player) {
      setError('No player specified')
      setLoading(false)
      return
    }

    fetch(`/api/player-stats?player=${encodeURIComponent(player)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to fetch player stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: TEXT_SECONDARY }}>
        Loading player analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ color: RED, marginBottom: '12px' }}>❌ {error || 'Unknown error'}</p>
        <a href="/admin/scrim-players" style={{ color: TEXT_SECONDARY, fontSize: '13px', textDecoration: 'none' }}>
          ← Back to players
        </a>
      </div>
    )
  }

  const handleMapSort = (key: MapSortKey) => {
    if (mapSortKey === key) {
      setMapSortDir(mapSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setMapSortKey(key)
      const numericKeys = ['eliminations', 'deaths', 'damage', 'healing', 'finalBlows', 'firstPickPct', 'firstDeathPct', 'fletaPct', 'ultCharge', 'ultHold', 'kPerUlt', 'drought']
      setMapSortDir(numericKeys.includes(key) ? 'desc' : 'asc')
    }
  }

  const sortedMaps = [...data.maps].sort((a, b) => {
    const va = a[mapSortKey]
    const vb = b[mapSortKey]
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return mapSortDir === 'asc' ? cmp : -cmp
  })

  const kd = data.career.deaths > 0
    ? (data.career.eliminations / data.career.deaths).toFixed(2)
    : data.career.eliminations.toString()

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <a href="/admin/scrim-players" style={{ color: TEXT_SECONDARY, fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          ← Back to players
        </a>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '12px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: TEXT_PRIMARY, letterSpacing: '-0.5px' }}>
            {data.player.name}
          </h1>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            padding: '3px 10px',
            borderRadius: '4px',
            background: CYAN_DIM,
            color: CYAN,
          }}>
            {data.player.mostPlayedHero}
          </span>
        </div>
        <p style={{ color: TEXT_SECONDARY, fontSize: '14px', marginTop: '6px' }}>
          {data.player.team} · {data.player.mapsPlayed} map{data.player.mapsPlayed !== 1 ? 's' : ''} played
        </p>
      </div>

      {/* Career Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <SummaryCard label="K/D Ratio" value={kd} sub={`${data.career.eliminations} E / ${data.career.deaths} D`} accentColor={CYAN} />
        <SummaryCard label="Total Damage" value={formatNumber(data.career.damage)} sub={`${formatNumber(Math.round(data.career.damage / data.player.mapsPlayed))} avg per map`} accentColor={RED} />
        <SummaryCard label="Total Healing" value={formatNumber(data.career.healing)} sub={`${formatNumber(Math.round(data.career.healing / data.player.mapsPlayed))} avg per map`} accentColor={GREEN} />
        <SummaryCard label="Avg First Pick" value={`${data.career.avgFirstPickPct}%`} sub={`${data.career.avgFirstDeathPct}% avg first death`} accentColor={PURPLE} />
      </div>

      {/* Hero Pool */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '16px 20px 10px', fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}` }}>
          Hero Pool
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1px', background: BORDER }}>
          {data.heroPool.map((h) => (
            <div key={h.hero} style={{ padding: '16px 20px', background: BG_CARD }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: TEXT_PRIMARY }}>{h.hero}</span>
                <span style={{ fontSize: '11px', color: TEXT_DIM }}>{h.mapsPlayed} map{h.mapsPlayed !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ fontSize: '12px', color: TEXT_SECONDARY, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Time</span>
                  <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{formatTime(h.totalTime)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Elims / Deaths</span>
                  <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{h.totalElims} / {h.totalDeaths}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Damage</span>
                  <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{formatNumber(h.totalDamage)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Healing</span>
                  <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{formatNumber(h.totalHealing)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map History */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 10px', fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}` }}>
          Map History
          <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM, marginLeft: '10px' }}>
            Click map to view full details
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {([
                  { key: 'mapName', label: 'Map', align: 'left' },
                  { key: 'hero', label: 'Hero', align: 'left' },
                  { key: 'scrimDate', label: 'Date', align: 'left' },
                  { key: 'eliminations', label: 'Elims', align: 'right' },
                  { key: 'deaths', label: 'Deaths', align: 'right' },
                  { key: 'finalBlows', label: 'FB', align: 'right' },
                  { key: 'damage', label: 'Damage', align: 'right' },
                  { key: 'healing', label: 'Healing', align: 'right' },
                  { key: 'firstPickPct', label: 'FP%', align: 'right' },
                  { key: 'firstDeathPct', label: 'FD%', align: 'right' },
                  { key: 'fletaPct', label: 'Fleta%', align: 'right' },
                  { key: 'ultCharge', label: 'Ult Charge', align: 'right' },
                  { key: 'kPerUlt', label: 'K/Ult', align: 'right' },
                  { key: 'drought', label: 'Drought', align: 'right' },
                ] as { key: MapSortKey; label: string; align: 'left' | 'right' }[]).map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleMapSort(col.key)}
                    style={{
                      padding: '10px 12px',
                      textAlign: col.align,
                      cursor: 'pointer',
                      fontWeight: mapSortKey === col.key ? 700 : 500,
                      color: mapSortKey === col.key ? CYAN : TEXT_SECONDARY,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      transition: 'color 0.15s',
                    }}
                  >
                    {col.label}
                    {mapSortKey === col.key && (mapSortDir === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMaps.map((m) => (
                <tr
                  key={m.mapDataId}
                  onClick={() => window.location.href = `/admin/scrim-map?mapId=${m.mapDataId}`}
                  style={{
                    cursor: 'pointer',
                    borderBottom: `1px solid ${BORDER}`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: TEXT_PRIMARY, whiteSpace: 'nowrap' }}>
                    {m.mapName}
                    <span style={{ fontSize: '10px', color: TEXT_DIM, marginLeft: '6px', fontWeight: 400 }}>
                      {m.mapType}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: TEXT_SECONDARY }}>{m.hero}</td>
                  <td style={{ padding: '10px 12px', color: TEXT_DIM, fontSize: '11px', whiteSpace: 'nowrap' }}>{formatDate(m.scrimDate)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.eliminations}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.deaths}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.finalBlows}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(m.damage)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(m.healing)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: m.firstPickPct > 20 ? GREEN : TEXT_PRIMARY }}>{m.firstPickPct}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: m.firstDeathPct > 20 ? RED : TEXT_PRIMARY }}>{m.firstDeathPct}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{m.fletaPct}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{m.ultCharge}s</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{m.kPerUlt}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{m.drought}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function SummaryCard({ label, value, sub, accentColor }: { label: string; value: string; sub: string; accentColor?: string }) {
  return (
    <div style={{
      ...CARD_STYLE,
      borderTop: accentColor ? `2px solid ${accentColor}` : `2px solid ${BORDER}`,
    }}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: accentColor ?? TEXT_PRIMARY, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '6px' }}>{sub}</div>
    </div>
  )
}
