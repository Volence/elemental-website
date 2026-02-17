'use client'

import React, { useState, useEffect, useRef } from 'react'

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
  portrait: string | null
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
  // Advanced per-hero stats
  avgFletaPct: number
  avgFirstPickPct: number
  avgFirstDeathPct: number
  avgUltChargeTime: number
  avgKillsPerUlt: number
  avgDroughtTime: number
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
const BORDER_GLOW = 'rgba(255, 255, 255, 0.08)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  borderRadius: '14px',
  padding: '20px',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: TEXT_SECONDARY,
  textTransform: 'uppercase' as const,
  letterSpacing: '1.2px',
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

// ── Inject global keyframes for the glow pulse animation ──
const STYLE_ID = 'scrim-player-detail-glow-styles'
function ensureGlobalStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes glowPulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `
  document.head.appendChild(style)
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
    ensureGlobalStyles()
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
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6, 182, 212, 0.08) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.05) 0%, transparent 50%),
        radial-gradient(ellipse 40% 60% at 10% 50%, rgba(6, 182, 212, 0.03) 0%, transparent 50%),
        linear-gradient(180deg, #0a0e1a 0%, #0d1117 40%, #0a0e1a 100%)
      `,
      overflow: 'hidden',
    }}>
      {/* Ambient floating glow orbs */}
      <div style={{ position: 'absolute', top: '10%', right: '5%', width: '400px', height: '400px', background: `radial-gradient(circle, ${CYAN}06 0%, transparent 70%)`, borderRadius: '50%', pointerEvents: 'none', animation: 'glowPulse 8s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '20%', left: '3%', width: '300px', height: '300px', background: `radial-gradient(circle, ${PURPLE}05 0%, transparent 70%)`, borderRadius: '50%', pointerEvents: 'none', animation: 'glowPulse 10s ease-in-out infinite 2s' }} />
      {/* Top edge glow line */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: `linear-gradient(90deg, transparent, ${CYAN}22, transparent)`, pointerEvents: 'none' }} />
      {/* Vignette overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '40px', maxWidth: '1600px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <a href="/admin/scrim-players" style={{ color: TEXT_SECONDARY, fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}>
          ← Back to players
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: TEXT_PRIMARY, letterSpacing: '-0.5px', textShadow: `0 0 40px ${CYAN}33` }}>
            {data.player.name}
          </h1>
          <span style={{
            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px',
            padding: '3px 10px', borderRadius: '6px',
            background: `linear-gradient(135deg, ${CYAN_DIM}, rgba(6, 182, 212, 0.06))`,
            color: CYAN, boxShadow: `0 0 12px ${CYAN}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
            border: `1px solid ${CYAN}22`,
          }}>
            {data.player.mostPlayedHero}
          </span>
        </div>
        <p style={{ color: TEXT_SECONDARY, fontSize: '14px', marginTop: '6px' }}>
          {data.player.team} · {data.player.mapsPlayed} map{data.player.mapsPlayed !== 1 ? 's' : ''} played
        </p>
        <div style={{ width: '60px', height: '3px', background: `linear-gradient(90deg, ${CYAN}, ${CYAN}00)`, borderRadius: '2px', marginTop: '8px' }} />
      </div>

      {/* Career Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
        <SummaryCard label="K/D Ratio" value={kd} sub={`${data.career.eliminations} E / ${data.career.deaths} D`} accentColor={CYAN} icon="⚔️" />
        <SummaryCard label="Total Damage" value={formatNumber(data.career.damage)} sub={`${formatNumber(Math.round(data.career.damage / data.player.mapsPlayed))} avg per map`} accentColor={RED} icon="💥" />
        <SummaryCard label="Total Healing" value={formatNumber(data.career.healing)} sub={`${formatNumber(Math.round(data.career.healing / data.player.mapsPlayed))} avg per map`} accentColor={GREEN} icon="💚" />
        <SummaryCard label="Avg First Pick" value={`${data.career.avgFirstPickPct}%`} sub={`${data.career.avgFirstDeathPct}% avg first death`} accentColor={PURPLE} icon="🎯" />
      </div>

      {/* Hero Pool — Playtime Distribution */}
      <div style={{ ...CARD_STYLE, marginBottom: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ textShadow: `0 0 20px ${CYAN}22` }}>Hero Pool</span>
          <span style={{ fontSize: '11px', color: TEXT_DIM, fontWeight: 400 }}>
            {data.heroPool.length} hero{data.heroPool.length !== 1 ? 'es' : ''} · Click a hero to expand
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
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden', marginTop: '20px' }}>
        <div style={{ padding: '16px 20px 10px', fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ textShadow: `0 0 20px ${CYAN}22` }}>Map History</span>
          <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM }}>Click to view full details</span>
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
                      whiteSpace: 'nowrap', userSelect: 'none', transition: 'color 0.2s',
                      textShadow: mapSortKey === col.key ? `0 0 8px ${CYAN}44` : 'none',
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
                  style={{ cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, transition: 'background 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6, 182, 212, 0.04)'; e.currentTarget.style.boxShadow = `inset 3px 0 0 ${CYAN}44` }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: CYAN, whiteSpace: 'nowrap', textShadow: `0 0 8px ${CYAN}22` }}>
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
    </div>
  )
}

// ── Sub-components ──

/** Animated collapse wrapper — uses max-height transition */
function AnimatedCollapse({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<string>(isOpen ? 'none' : '0px')
  const [opacity, setOpacity] = useState(isOpen ? 1 : 0)

  useEffect(() => {
    if (isOpen) {
      // Measure content then animate in
      const el = contentRef.current
      if (el) {
        const height = el.scrollHeight
        setMaxHeight(`${height}px`)
        setOpacity(1)
        // After transition, remove max-height constraint so content can resize
        const timer = setTimeout(() => setMaxHeight('none'), 350)
        return () => clearTimeout(timer)
      }
    } else {
      // Snap to measured height first, then animate to 0
      const el = contentRef.current
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`)
        // Force reflow before setting to 0
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMaxHeight('0px')
            setOpacity(0)
          })
        })
      } else {
        setMaxHeight('0px')
        setOpacity(0)
      }
    }
  }, [isOpen])

  return (
    <div
      ref={contentRef}
      style={{
        maxHeight,
        opacity,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
      }}
    >
      {children}
    </div>
  )
}

/** Hero avatar with glow ring */
function HeroAvatar({ portrait, heroName, size = 52, color }: { portrait: string | null; heroName: string; size?: number; color: string }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}33, ${color}11)`,
      border: `2px solid ${color}66`,
      boxShadow: `0 0 16px ${color}33, inset 0 0 8px ${color}11`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
    }}>
      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portrait}
          alt={heroName}
          style={{
            width: size - 4,
            height: size - 4,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span style={{ fontSize: size * 0.4, color: `${color}88` }}>
          {heroName.charAt(0)}
        </span>
      )}
      {/* Glow ring animation */}
      <div style={{
        position: 'absolute',
        inset: '-2px',
        borderRadius: '50%',
        border: `1px solid ${color}44`,
        animation: 'glowPulse 3s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

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
      transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      boxShadow: isExpanded
        ? `0 4px 30px rgba(0,0,0,0.4), 0 0 30px ${color}11, inset 0 1px 0 rgba(255,255,255,0.04)`
        : `0 4px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
    }}>
      {/* Header — always visible */}
      <div
        onClick={onToggle}
        style={{
          padding: '16px 24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Radial glow behind avatar */}
        <div style={{
          position: 'absolute', top: '-40px', left: '-20px',
          width: '180px', height: '180px',
          background: `radial-gradient(circle, ${color}0c 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
          <HeroAvatar portrait={h.portrait} heroName={h.hero} size={48} color={color} />
          <div>
            <span style={{ fontWeight: 700, fontSize: '18px', color: TEXT_PRIMARY, textShadow: `0 0 16px ${color}33` }}>
              {h.hero}
            </span>
            <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '2px' }}>
              {h.mapsPlayed} map{h.mapsPlayed !== 1 ? 's' : ''} · {formatTime(h.totalTime)}
            </div>
          </div>
        </div>

        {/* Quick stats in header */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', position: 'relative' }}>
          <QuickStat label="K/D" value={kd} color={parseFloat(kd) >= 2 ? GREEN : parseFloat(kd) < 1 ? RED : TEXT_PRIMARY} />
          <QuickStat label="Elims" value={String(h.totalElims)} />
          <QuickStat label="Deaths" value={String(h.totalDeaths)} />
          <QuickStat label="Dmg" value={formatNumber(h.totalDamage)} />
          <QuickStat label="Heal" value={formatNumber(h.totalHealing)} />
          <QuickStat label="Ults" value={String(h.ultimatesUsed)} />
          <span style={{
            fontSize: '16px', color: TEXT_DIM,
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            display: 'inline-block',
          }}>
            ▾
          </span>
        </div>
      </div>

      {/* Animated expanded detail area */}
      <AnimatedCollapse isOpen={isExpanded}>
        <div style={{ borderTop: `1px solid ${BORDER_GLOW}`, padding: '24px' }}>
          {/* Hero identity row + highlight cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Large avatar with key stat ring */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
              background: `radial-gradient(circle, ${color}0c 0%, transparent 70%)`,
              borderRadius: '12px',
              border: `1px solid ${BORDER}`,
              padding: '16px 12px',
            }}>
              <HeroAvatar portrait={h.portrait} heroName={h.hero} size={80} color={color} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: kd_color(kd), textShadow: `0 0 12px ${kd_color(kd)}44` }}>
                  {kd} K/D
                </div>
                <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px' }}>
                  {formatDecimal(timeMins, 1)} min played
                </div>
              </div>
            </div>
            {/* Highlight cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <MiniStatCard label="Eliminations" value={String(h.totalElims)} sub={`${formatDecimal(h.elimsPer10)} /10 min`} color={CYAN} />
              <MiniStatCard label="Hero Damage" value={formatNumber(h.totalDamage)} sub={`${formatNumber(h.damagePer10)} /10 min`} color={RED} />
              <MiniStatCard label="Healing Dealt" value={formatNumber(h.totalHealing)} sub={`${formatNumber(h.healingPer10)} /10 min`} color={GREEN} />
              <MiniStatCard label="Ultimates Used" value={String(h.ultimatesUsed)} sub={`${formatDecimal(h.ultsPer10)} /10 min`} color={PURPLE} />
            </div>
          </div>

          {/* Categorized stat groups — 3-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <StatGroupCard title="⚔️ Combat" color={RED} stats={[
              { label: 'Eliminations', value: String(h.totalElims), sub: `${formatDecimal(h.elimsPer10)} /10` },
              { label: 'Final Blows', value: String(h.totalFB), sub: `${formatDecimal(h.fbPer10)} /10` },
              { label: 'Solo Kills', value: String(h.soloKills), sub: `${formatDecimal(h.soloKillsPer10)} /10` },
              { label: 'Deaths', value: String(h.totalDeaths), sub: `${formatDecimal(h.deathsPer10)} /10` },
              { label: 'Objective Kills', value: String(h.objectiveKills), sub: timeMins > 0 ? `${formatDecimal(h.objectiveKills / timeMins * 10)} /10` : '—' },
              { label: 'Env. Kills', value: String(h.environmentalKills) },
              { label: 'Env. Deaths', value: String(h.environmentalDeaths) },
              { label: 'Multikills', value: String(h.multikills) },
              { label: 'Best Multi', value: String(h.multikillBest) },
            ]} />

            <StatGroupCard title="💥 Damage & Survivability" color={AMBER} stats={[
              { label: 'All Damage', value: formatNumber(h.allDamageDealt), sub: `${formatNumber(h.damagePer10)} /10` },
              { label: 'Hero Damage', value: formatNumber(h.totalDamage) },
              { label: 'Barrier Damage', value: formatNumber(h.barrierDamageDealt), sub: timeMins > 0 ? `${formatNumber(Math.round(h.barrierDamageDealt / timeMins * 10))} /10` : '—' },
              { label: 'Damage Taken', value: formatNumber(h.damageTaken), sub: timeMins > 0 ? `${formatNumber(Math.round(h.damageTaken / timeMins * 10))} /10` : '—' },
              { label: 'Damage Blocked', value: formatNumber(h.damageBlocked), sub: timeMins > 0 ? `${formatNumber(Math.round(h.damageBlocked / timeMins * 10))} /10` : '—' },
            ]} />

            <StatGroupCard title="💚 Healing & Support" color={GREEN} stats={[
              { label: 'Healing Dealt', value: formatNumber(h.totalHealing), sub: `${formatNumber(h.healingPer10)} /10` },
              { label: 'Healing Received', value: formatNumber(h.healingReceived), sub: timeMins > 0 ? `${formatNumber(Math.round(h.healingReceived / timeMins * 10))} /10` : '—' },
              { label: 'Self Healing', value: formatNumber(h.selfHealing), sub: timeMins > 0 ? `${formatNumber(Math.round(h.selfHealing / timeMins * 10))} /10` : '—' },
              { label: 'Def. Assists', value: String(h.defensiveAssists), sub: timeMins > 0 ? `${formatDecimal(h.defensiveAssists / timeMins * 10)} /10` : '—' },
              { label: 'Off. Assists', value: String(h.offensiveAssists), sub: timeMins > 0 ? `${formatDecimal(h.offensiveAssists / timeMins * 10)} /10` : '—' },
            ]} />

            <StatGroupCard title="⚡ Ultimates" color={PURPLE} stats={[
              { label: 'Ults Earned', value: String(h.ultimatesEarned), sub: `${formatDecimal(h.ultsPer10)} /10` },
              { label: 'Ults Used', value: String(h.ultimatesUsed), sub: `${formatDecimal(h.ultsPer10)} /10` },
              { label: 'Avg Charge Time', value: `${h.avgUltChargeTime}s` },
              { label: 'Kills / Ult', value: formatDecimal(h.avgKillsPerUlt) },
              { label: 'Drought', value: `${h.avgDroughtTime}s` },
            ]} />

            <StatGroupCard title="🎯 Accuracy" color={CYAN} stats={[
              { label: 'Weapon Accuracy', value: formatPct(h.weaponAccuracy) },
              { label: 'Crit Accuracy', value: formatPct(h.criticalHitAccuracy) },
              { label: 'Critical Hits', value: String(h.criticalHits), sub: timeMins > 0 ? `${formatDecimal(h.criticalHits / timeMins * 10)} /10` : '—' },
              ...(h.scopedAccuracy > 0 ? [{ label: 'Scoped Accuracy', value: formatPct(h.scopedAccuracy) }] : []),
            ]} />

            <StatGroupCard title="🏆 Performance" color={GREEN} stats={[
              { label: 'Fleta Deadlift', value: `${h.avgFletaPct}%`, sub: 'Earns 50%+ of team final blows' },
              { label: 'First Pick', value: `${h.avgFirstPickPct}%`, sub: `Across ${h.mapsPlayed} map${h.mapsPlayed !== 1 ? 's' : ''}` },
              { label: 'First Death', value: `${h.avgFirstDeathPct}%`, sub: h.avgFirstDeathPct > 20 ? 'High — watch positioning' : 'Healthy' },
            ]} />

            <StatGroupCard title="📊 Per 10 Min Overview" color={TEXT_SECONDARY} stats={[
              { label: 'Elims /10', value: formatDecimal(h.elimsPer10) },
              { label: 'Deaths /10', value: formatDecimal(h.deathsPer10) },
              { label: 'FB /10', value: formatDecimal(h.fbPer10) },
              { label: 'Damage /10', value: formatNumber(h.damagePer10) },
              { label: 'Healing /10', value: formatNumber(h.healingPer10) },
              { label: 'Ults /10', value: formatDecimal(h.ultsPer10) },
            ]} />
          </div>
        </div>
      </AnimatedCollapse>
    </div>
  )
}

/** K/D ratio color helper */
function kd_color(kd: string): string {
  const v = parseFloat(kd)
  if (v >= 2) return GREEN
  if (v < 1) return RED
  return TEXT_PRIMARY
}

type StatGroupItem = { label: string; value: string; sub?: string }

/** Categorized stat group card — compact label-value pairs in a glassmorphic container */
function StatGroupCard({ title, color, stats }: { title: string; color: string; stats: StatGroupItem[] }) {
  return (
    <div style={{
      background: BG_INNER,
      border: `1px solid ${BORDER_GLOW}`,
      borderTop: `2px solid ${color}`,
      borderRadius: '10px',
      overflow: 'hidden',
      animation: 'fadeSlideIn 0.3s ease-out',
    }}>
      {/* Group header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${BORDER}`,
        fontSize: '12px',
        fontWeight: 700,
        color: TEXT_PRIMARY,
        letterSpacing: '0.3px',
        textShadow: `0 0 12px ${color}22`,
      }}>
        {title}
      </div>
      {/* Stat rows */}
      <div style={{ padding: '6px 0' }}>
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 14px',
              transition: 'background 0.15s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: '12px', color: TEXT_SECONDARY, fontWeight: 500 }}>{s.label}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
              {s.sub && <span style={{ fontSize: '10px', color: TEXT_DIM, fontVariantNumeric: 'tabular-nums' }}>{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>
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
      border: `1px solid ${BORDER_GLOW}`,
      borderTop: `2px solid ${color}`,
      borderRadius: '10px',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
      animation: 'fadeSlideIn 0.3s ease-out',
    }}>
      <div style={{
        position: 'absolute', top: '-15px', right: '-15px',
        width: '90px', height: '90px',
        background: `radial-gradient(circle, ${color}0a 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: '11px', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: '6px', position: 'relative' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, letterSpacing: '-0.5px', textShadow: `0 0 16px ${color}44`, position: 'relative' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '4px', position: 'relative' }}>{sub}</div>
    </div>
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
      boxShadow: `0 4px 30px rgba(0,0,0,0.4), 0 0 40px ${ac}08`,
    }}>
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '130px', height: '130px',
        background: `radial-gradient(circle, ${ac}0c 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div style={LABEL_STYLE}>{label}</div>
        {icon && <span style={{ fontSize: '16px', opacity: 0.5 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: ac, letterSpacing: '-0.5px', lineHeight: 1.2, textShadow: `0 0 20px ${ac}44`, position: 'relative' }}>
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
            style={{ cursor: 'pointer', padding: '4px 0', transition: 'opacity 0.2s', opacity: expandedHero && !isSelected ? 0.45 : 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HeroAvatar portrait={h.portrait} heroName={h.hero} size={24} color={color} />
                <span style={{ color: isSelected ? color : TEXT_PRIMARY, fontWeight: 600, transition: 'color 0.2s', textShadow: isSelected ? `0 0 8px ${color}44` : 'none' }}>{h.hero}</span>
              </div>
              <span style={{ color: TEXT_SECONDARY }}>{pct}% · {formatTime(h.totalTime)}</span>
            </div>
            <div style={{
              width: '100%', height: '8px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: '4px',
                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                boxShadow: isSelected ? `0 0 14px ${color}66` : `0 0 4px ${color}22`,
                transition: 'width 0.6s ease, box-shadow 0.3s',
                minWidth: pct > 0 ? '4px' : '0',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
