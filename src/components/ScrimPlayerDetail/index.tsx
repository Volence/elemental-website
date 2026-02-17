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
  // Extended stats
  allDamageDealt: number
  barrierDamageDealt: number
  healingReceived: number
  selfHealing: number
  damageTaken: number
  damageBlocked: number
  defensiveAssists: number
  offensiveAssists: number
  ultimatesEarned: number
  ultimatesUsed: number
  soloKills: number
  objectiveKills: number
  environmentalKills: number
  environmentalDeaths: number
  criticalHits: number
  criticalHitAccuracy: number
  weaponAccuracy: number
  multikillBest: number
  multikills: number
  scopedAccuracy: number
  // Per-10-min rates
  elimsPer10: number
  deathsPer10: number
  fbPer10: number
  damagePer10: number
  healingPer10: number
  ultsPer10: number
  soloKillsPer10: number
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

// ── Design tokens (Clean Glow) ──
const CYAN = '#06b6d4'
const CYAN_DIM = 'rgba(6, 182, 212, 0.12)'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const BG_CARD = 'rgba(15, 15, 30, 0.7)'
const BG_INNER = 'rgba(20, 20, 40, 0.5)'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: TEXT_SECONDARY,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  fontWeight: 600,
  marginBottom: '8px',
}

const BAR_COLORS = [CYAN, PURPLE, GREEN, AMBER, RED, '#ec4899', '#6366f1']

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
function formatDecimal(n: number, dec = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
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
  const [expandedHero, setExpandedHero] = useState<string | null>(null)

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
        else {
          setData(d)
          // Auto-expand the most played hero
          if (d.heroPool?.length > 0) setExpandedHero(d.heroPool[0].hero)
        }
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
    <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <a href="/admin/scrim-players" style={{ color: TEXT_SECONDARY, fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          ← Back to players
        </a>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '12px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: TEXT_PRIMARY, letterSpacing: '-0.5px', textShadow: `0 0 30px ${CYAN}22` }}>
            {data.player.name}
          </h1>
          <span style={{
            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px',
            padding: '3px 10px', borderRadius: '4px', background: CYAN_DIM, color: CYAN, boxShadow: `0 0 8px ${CYAN}22`,
          }}>
            {data.player.mostPlayedHero}
          </span>
        </div>
        <p style={{ color: TEXT_SECONDARY, fontSize: '14px', marginTop: '6px' }}>
          {data.player.team} · {data.player.mapsPlayed} map{data.player.mapsPlayed !== 1 ? 's' : ''} played
        </p>
        <div style={{ width: '60px', height: '3px', background: `linear-gradient(90deg, ${CYAN}, transparent)`, borderRadius: '2px', marginTop: '8px' }} />
      </div>

      {/* Career Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <SummaryCard label="K/D Ratio" value={kd} sub={`${data.career.eliminations} E / ${data.career.deaths} D`} accentColor={CYAN} icon="⚔️" />
        <SummaryCard label="Total Damage" value={formatNumber(data.career.damage)} sub={`${formatNumber(Math.round(data.career.damage / data.player.mapsPlayed))} avg per map`} accentColor={RED} icon="💥" />
        <SummaryCard label="Total Healing" value={formatNumber(data.career.healing)} sub={`${formatNumber(Math.round(data.career.healing / data.player.mapsPlayed))} avg per map`} accentColor={GREEN} icon="💚" />
        <SummaryCard label="Avg First Pick" value={`${data.career.avgFirstPickPct}%`} sub={`${data.career.avgFirstDeathPct}% avg first death`} accentColor={PURPLE} icon="🎯" />
      </div>

      {/* Hero Pool — Playtime Distribution */}
      <div style={{ ...CARD_STYLE, marginBottom: '28px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Hero Pool
          <span style={{ fontSize: '11px', color: TEXT_DIM, fontWeight: 400 }}>
            {data.heroPool.length} hero{data.heroPool.length !== 1 ? 'es' : ''} · Click a hero to expand details
          </span>
        </div>
        <HeroPlaytimeChart heroPool={data.heroPool} expandedHero={expandedHero} onHeroClick={setExpandedHero} />
      </div>

      {/* Expanded Hero Sections */}
      {data.heroPool.map((h, idx) => {
        const isExpanded = expandedHero === h.hero
        const color = BAR_COLORS[idx % BAR_COLORS.length]
        return (
          <HeroDetailSection
            key={h.hero}
            hero={h}
            color={color}
            isExpanded={isExpanded}
            onToggle={() => setExpandedHero(isExpanded ? null : h.hero)}
          />
        )
      })}

      {/* Map History */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden', marginTop: '28px' }}>
        <div style={{ padding: '16px 20px 10px', fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Map History</span>
          <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM }}>Click map to view full details</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '1100px' }}>
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
                      padding: '10px 12px', textAlign: col.align, cursor: 'pointer',
                      fontWeight: mapSortKey === col.key ? 700 : 500,
                      color: mapSortKey === col.key ? CYAN : TEXT_SECONDARY,
                      fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px',
                      whiteSpace: 'nowrap', userSelect: 'none', transition: 'color 0.15s',
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
                  style={{ cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6, 182, 212, 0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: CYAN, whiteSpace: 'nowrap' }}>
                    {m.mapName}
                    <span style={{ fontSize: '10px', color: TEXT_DIM, marginLeft: '6px', fontWeight: 400 }}>{m.mapType}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: TEXT_SECONDARY }}>{m.hero}</td>
                  <td style={{ padding: '10px 12px', color: TEXT_DIM, fontSize: '11px', whiteSpace: 'nowrap' }}>{formatDate(m.scrimDate)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.eliminations}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.deaths}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.finalBlows}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(m.damage)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(m.healing)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: m.firstPickPct > 20 ? GREEN : TEXT_PRIMARY, fontWeight: m.firstPickPct > 20 ? 600 : 400 }}>{m.firstPickPct}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: m.firstDeathPct > 20 ? RED : TEXT_PRIMARY, fontWeight: m.firstDeathPct > 20 ? 600 : 400 }}>{m.firstDeathPct}%</td>
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

/** Top-level hero detail section — expanded view with full stat breakdown */
function HeroDetailSection({ hero: h, color, isExpanded, onToggle }: {
  hero: HeroPoolEntry; color: string; isExpanded: boolean; onToggle: () => void
}) {
  const kd = h.totalDeaths > 0 ? (h.totalElims / h.totalDeaths).toFixed(2) : h.totalElims.toString()
  const timeMins = h.totalTime / 60

  return (
    <div style={{
      ...CARD_STYLE,
      padding: 0,
      overflow: 'hidden',
      marginBottom: '12px',
      borderLeft: `3px solid ${color}`,
      transition: 'all 0.2s ease',
    }}>
      {/* Header / Collapsed row — always visible */}
      <div
        onClick={onToggle}
        style={{
          padding: '16px 24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background 0.15s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '-30px', left: '-30px',
          width: '150px', height: '150px',
          background: `radial-gradient(circle, ${color}0a 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
          <span style={{ fontWeight: 700, fontSize: '18px', color: TEXT_PRIMARY, textShadow: `0 0 12px ${color}33` }}>
            {h.hero}
          </span>
          <span style={{ fontSize: '12px', color: TEXT_DIM }}>
            {h.mapsPlayed} map{h.mapsPlayed !== 1 ? 's' : ''} · {formatTime(h.totalTime)}
          </span>
        </div>

        {/* Quick stats in the collapsed header */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', position: 'relative' }}>
          <QuickStat label="K/D" value={kd} color={parseFloat(kd) >= 2 ? GREEN : parseFloat(kd) < 1 ? RED : TEXT_PRIMARY} />
          <QuickStat label="Elims" value={String(h.totalElims)} />
          <QuickStat label="Deaths" value={String(h.totalDeaths)} />
          <QuickStat label="Dmg" value={formatNumber(h.totalDamage)} />
          <QuickStat label="Heal" value={formatNumber(h.totalHealing)} />
          <QuickStat label="Ults" value={String(h.ultimatesUsed)} />
          <span style={{ fontSize: '16px', color: TEXT_DIM, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expanded detail area */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '24px' }}>
          {/* Top row: 4 highlight cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <MiniStatCard label="Ultimates Used" value={String(h.ultimatesUsed)} sub={`${formatDecimal(h.ultsPer10)} per 10 min`} color={PURPLE} />
            <MiniStatCard label="Hero Damage Dealt" value={formatNumber(h.totalDamage)} sub={`${formatNumber(h.damagePer10)} per 10 min`} color={RED} />
            <MiniStatCard label="Final Blows" value={String(h.totalFB)} sub={`${formatDecimal(h.fbPer10)} per 10 min`} color={AMBER} />
            <MiniStatCard label="Solo Kills" value={String(h.soloKills)} sub={`${formatDecimal(h.soloKillsPer10)} per 10 min`} color={CYAN} />
          </div>

          {/* Full stat table */}
          <div style={{
            background: BG_INNER,
            border: `1px solid ${BORDER}`,
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: TEXT_SECONDARY, fontWeight: 600 }}>Stat</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: TEXT_SECONDARY, fontWeight: 600 }}>Total</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: TEXT_SECONDARY, fontWeight: 600 }}>Avg/10 min</th>
                </tr>
              </thead>
              <tbody>
                <StatTableRow label="Hero Time Played" total={`${formatDecimal(timeMins)} mins`} avg="—" />
                <StatTableRow label="Eliminations" total={String(h.totalElims)} avg={formatDecimal(h.elimsPer10)} />
                <StatTableRow label="Final Blows" total={String(h.totalFB)} avg={formatDecimal(h.fbPer10)} />
                <StatTableRow label="Deaths" total={String(h.totalDeaths)} avg={formatDecimal(h.deathsPer10)} />
                <StatTableRow label="All Damage Dealt" total={formatNumber(h.allDamageDealt)} avg={formatNumber(h.damagePer10)} />
                <StatTableRow label="Barrier Damage Dealt" total={formatNumber(h.barrierDamageDealt)} avg={timeMins > 0 ? formatNumber(Math.round(h.barrierDamageDealt / timeMins * 10)) : '0'} />
                <StatTableRow label="Hero Damage Dealt" total={formatNumber(h.totalDamage)} avg={formatNumber(h.damagePer10)} />
                <StatTableRow label="Healing Dealt" total={formatNumber(h.totalHealing)} avg={formatNumber(h.healingPer10)} />
                <StatTableRow label="Healing Received" total={formatNumber(h.healingReceived)} avg={timeMins > 0 ? formatNumber(Math.round(h.healingReceived / timeMins * 10)) : '0'} />
                <StatTableRow label="Self Healing" total={formatNumber(h.selfHealing)} avg={timeMins > 0 ? formatNumber(Math.round(h.selfHealing / timeMins * 10)) : '0'} />
                <StatTableRow label="Damage Taken" total={formatNumber(h.damageTaken)} avg={timeMins > 0 ? formatNumber(Math.round(h.damageTaken / timeMins * 10)) : '0'} />
                <StatTableRow label="Damage Blocked" total={formatNumber(h.damageBlocked)} avg={timeMins > 0 ? formatNumber(Math.round(h.damageBlocked / timeMins * 10)) : '0'} />
                <StatTableRow label="Defensive Assists" total={String(h.defensiveAssists)} avg={timeMins > 0 ? formatDecimal(h.defensiveAssists / timeMins * 10) : '0'} />
                <StatTableRow label="Offensive Assists" total={String(h.offensiveAssists)} avg={timeMins > 0 ? formatDecimal(h.offensiveAssists / timeMins * 10) : '0'} />
                <StatTableRow label="Ultimates Earned" total={String(h.ultimatesEarned)} avg={formatDecimal(h.ultsPer10)} />
                <StatTableRow label="Ultimates Used" total={String(h.ultimatesUsed)} avg={formatDecimal(h.ultsPer10)} />
                <StatTableRow label="Solo Kills" total={String(h.soloKills)} avg={formatDecimal(h.soloKillsPer10)} />
                <StatTableRow label="Objective Kills" total={String(h.objectiveKills)} avg={timeMins > 0 ? formatDecimal(h.objectiveKills / timeMins * 10) : '0'} />
                <StatTableRow label="Environmental Kills" total={String(h.environmentalKills)} avg="—" />
                <StatTableRow label="Environmental Deaths" total={String(h.environmentalDeaths)} avg="—" />
                <StatTableRow label="Critical Hits" total={String(h.criticalHits)} avg={timeMins > 0 ? formatDecimal(h.criticalHits / timeMins * 10) : '0'} />
                <StatTableRow label="Multikills" total={String(h.multikills)} avg="—" />
                <StatTableRow label="Multikill Best" total={String(h.multikillBest)} avg="—" />
                <StatTableRow label="Weapon Accuracy" total={formatPct(h.weaponAccuracy)} avg="—" />
                <StatTableRow label="Critical Hit Accuracy" total={formatPct(h.criticalHitAccuracy)} avg="—" />
                {h.scopedAccuracy > 0 && (
                  <StatTableRow label="Scoped Accuracy" total={formatPct(h.scopedAccuracy)} avg="—" />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Quick stat shown in collapsed hero header */
function QuickStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: color ?? TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

/** Mini stat card for the hero detail expanded area */
function MiniStatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: BG_INNER,
      border: `1px solid ${BORDER}`,
      borderTop: `2px solid ${color}`,
      borderRadius: '8px',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-15px', right: '-15px',
        width: '80px', height: '80px',
        background: `radial-gradient(circle, ${color}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: '11px', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '6px', position: 'relative' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, letterSpacing: '-0.5px', textShadow: `0 0 12px ${color}44`, position: 'relative' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '4px', position: 'relative' }}>{sub}</div>
    </div>
  )
}

/** Individual row in the stat table */
function StatTableRow({ label, total, avg }: { label: string; total: string; avg: string }) {
  return (
    <tr
      style={{ borderBottom: `1px solid ${BORDER}`, transition: 'background 0.1s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '8px 16px', color: TEXT_SECONDARY, fontWeight: 500 }}>{label}</td>
      <td style={{ padding: '8px 16px', textAlign: 'right', color: TEXT_PRIMARY, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{total}</td>
      <td style={{ padding: '8px 16px', textAlign: 'right', color: TEXT_DIM, fontVariantNumeric: 'tabular-nums' }}>{avg}</td>
    </tr>
  )
}

function SummaryCard({ label, value, sub, accentColor, icon }: { label: string; value: string; sub: string; accentColor?: string; icon?: string }) {
  const ac = accentColor ?? CYAN
  return (
    <div style={{
      ...CARD_STYLE,
      borderTop: `2px solid ${ac}`,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 0 20px rgba(0,0,0,0.3), 0 0 30px ${ac}08`,
    }}>
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '120px', height: '120px',
        background: `radial-gradient(circle, ${ac}0a 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div style={LABEL_STYLE}>{label}</div>
        {icon && <span style={{ fontSize: '16px', opacity: 0.5 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: ac, letterSpacing: '-0.5px', lineHeight: 1.2, textShadow: `0 0 16px ${ac}44`, position: 'relative' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '6px', position: 'relative' }}>{sub}</div>
    </div>
  )
}

function HeroPlaytimeChart({ heroPool, expandedHero, onHeroClick }: { heroPool: HeroPoolEntry[]; expandedHero: string | null; onHeroClick: (hero: string) => void }) {
  const totalTime = heroPool.reduce((a, h) => a + h.totalTime, 0)
  if (totalTime === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {heroPool.map((h, i) => {
        const pct = Math.round((h.totalTime / totalTime) * 100)
        const color = BAR_COLORS[i % BAR_COLORS.length]
        const isSelected = expandedHero === h.hero
        return (
          <div
            key={h.hero}
            onClick={() => onHeroClick(h.hero)}
            style={{ cursor: 'pointer', padding: '4px 0', transition: 'opacity 0.15s', opacity: expandedHero && !isSelected ? 0.5 : 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
              <span style={{ color: isSelected ? color : TEXT_PRIMARY, fontWeight: 600, transition: 'color 0.15s' }}>{h.hero}</span>
              <span style={{ color: TEXT_SECONDARY }}>{pct}% · {formatTime(h.totalTime)}</span>
            </div>
            <div style={{
              width: '100%', height: '8px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: '4px',
                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                boxShadow: isSelected ? `0 0 12px ${color}66` : `0 0 4px ${color}22`,
                transition: 'width 0.6s ease, box-shadow 0.2s',
                minWidth: pct > 0 ? '4px' : '0',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
