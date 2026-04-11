'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, AlertCircle, ArrowLeft, ChevronDown, Swords, Heart, Crosshair, Zap, Clock, Skull, Trophy, MapPin, TrendingUp, Flame } from 'lucide-react'
import RangeFilter, { type RangeValue } from '@/components/RangeFilter'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'

// ── Types ──

type PlayerInfo = {
  name: string
  team: string
  payloadTeamId: number | null
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
  avgUltHoldTime: number
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

type TrendEntry = {
  scrimDate: string
  scrimName: string
  mapCount: number
  elimsPer10: number; fbPer10: number; deathsPer10: number
  damagePer10: number; healingPer10: number; damageTakenPer10: number
  damageBlockedPer10: number; ultsEarnedPer10: number
  soloKillsPer10: number; envKillsPer10: number
}

type HeroMatchup = { hero: string; count: number }

type MapWinrate = { map: string; wins: number; losses: number; draws: number; total: number; winrate: number }
type MapTypeWinrate = { mapType: string; wins: number; losses: number; draws: number; total: number; winrate: number }
type FBMethod = { method: string; count: number }

type PlayerData = {
  player: PlayerInfo
  career: CareerStats
  heroPool: HeroPoolEntry[]
  maps: MapEntry[]
  trendData: TrendEntry[]
  heroMatchups: { killedMost: HeroMatchup[]; diedToMost: HeroMatchup[] }
  mapWinrates: MapWinrate[]
  mapTypeWinrates: MapTypeWinrate[]
  roleTimeSplit: Record<string, number>
  finalBlowsByMethod: FBMethod[]
}

type MapSortKey = keyof MapEntry
type SortDir = 'asc' | 'desc'
type TabKey = 'overview' | 'analytics' | 'charts'

// ── Dynamic color tokens (kept for runtime-computed styles in SVG charts & sub-components) ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const BG_INNER = 'rgba(255, 255, 255, 0.02)'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const BORDER_GLOW = 'rgba(255, 255, 255, 0.08)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'

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
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [analyticsHero, setAnalyticsHero] = useState<string | null>(null)
  const [chartsHero, setChartsHero] = useState<string | null>(null)
  const [chartsMap, setChartsMap] = useState<string>('all')
  const [trendStat, setTrendStat] = useState<string>('damagePer10')
  const [range, setRange] = useState<RangeValue>('last20')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const personId = params.get('personId')
    const player = params.get('player')

    if (!personId && !player) {
      setError('No player specified')
      setLoading(false)
      return
    }

    // Prefer personId (merged profile) over raw player name
    const apiUrl = personId
      ? `/api/player-stats?personId=${encodeURIComponent(personId)}&range=${range}`
      : `/api/player-stats?player=${encodeURIComponent(player!)}&range=${range}`

    fetch(apiUrl)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else {
          setData(d)
          if (d.heroPool?.length > 0) {
            setExpandedHero(d.heroPool[0].hero)
            setAnalyticsHero(d.heroPool[0].hero)
            setChartsHero(d.heroPool[0].hero)
          }
        }
      })
      .catch(() => setError('Failed to fetch player stats'))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) {
    return (
      <>
      <ScrimAnalyticsTabs activeTab="players" />
      <div className="scrim-players__loading">
        <div className="scrim-players__loading-icon">
          <Loader2 size={32} />
        </div>
        <div className="scrim-players__loading-text">Loading player analytics…</div>
      </div>
      </>
    )
  }
  if (error || !data) {
    return (
      <>
      <ScrimAnalyticsTabs activeTab="players" />
      <div className="scrim-players__error">
        <p><AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />{error || 'Unknown error'}</p>
        <a href="/admin/scrim-players" className="scrim-detail__back-link">
          <ArrowLeft size={12} /> Back to players
        </a>
      </div>
      </>
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
    <>
    <ScrimAnalyticsTabs activeTab="players" />
    <div className="scrim-detail scrim-detail__bg">
      {/* Ambient floating glow orbs */}
      <div className="scrim-detail__orb" style={{ top: '10%', right: '5%', width: '400px', height: '400px', background: `radial-gradient(circle, ${CYAN}06 0%, transparent 70%)` }} />
      <div className="scrim-detail__orb" style={{ bottom: '20%', left: '3%', width: '300px', height: '300px', background: `radial-gradient(circle, ${PURPLE}05 0%, transparent 70%)`, animationDuration: '10s', animationDelay: '2s' }} />
      <div className="scrim-detail__edge-glow" />
      <div className="scrim-detail__vignette" />

      <div className="scrim-detail__content">
      {/* Header */}
      <div className="scrim-detail__header">
        <a href="/admin/scrim-players" className="scrim-detail__back-link">
          <ArrowLeft size={12} /> Back to players
        </a>
        <div className="scrim-detail__header-row">
          <div>
            <h1 className="scrim-detail__player-name">
              {data.player.name}
            </h1>
            <p className="scrim-detail__player-meta">
              {data.player.payloadTeamId ? (
                <a
                  href={`/admin/scrim-team?teamId=${data.player.payloadTeamId}`}
                  className="scrim-detail__team-link"
                >
                  {data.player.team}
                </a>
              ) : (
                data.player.team
              )} · {data.player.mapsPlayed} map{data.player.mapsPlayed !== 1 ? 's' : ''} played
            </p>
          </div>
          <RangeFilter value={range} onChange={setRange} />
        </div>
        <div className="scrim-detail__accent-bar" />
      </div>

      {/* Tab Bar */}
      <div className="scrim-detail__tabs">
        {(['overview', 'analytics', 'charts'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`scrim-detail__tab ${activeTab === tab ? 'scrim-detail__tab--active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ═══════════ Overview Tab ═══════════ */}
      {activeTab === 'overview' && <>
      {/* Career Summary Cards */}
      <div className="scrim-detail__stat-grid">
        <SummaryCard label="K/D Ratio" value={kd} sub={`${data.career.eliminations} E / ${data.career.deaths} D`} accentColor={CYAN} icon={<Swords size={16} />} />
        <SummaryCard label="Total Damage" value={formatNumber(data.career.damage)} sub={`${formatNumber(Math.round(data.career.damage / data.player.mapsPlayed))} avg per map`} accentColor={RED} icon={<Flame size={16} />} />
        <SummaryCard label="Total Healing" value={formatNumber(data.career.healing)} sub={`${formatNumber(Math.round(data.career.healing / data.player.mapsPlayed))} avg per map`} accentColor={GREEN} icon={<Heart size={16} />} />
        <SummaryCard label="Avg First Pick" value={`${data.career.avgFirstPickPct}%`} sub={`${data.career.avgFirstDeathPct}% avg first death`} accentColor={PURPLE} icon={<Crosshair size={16} />} />
      </div>

      {/* Hero Pool — Playtime Distribution */}
      <div className="scrim-detail__card scrim-detail__card--mb">
        <div className="scrim-detail__card-header">
          <span className="scrim-detail__card-header-glow">Hero Pool</span>
          <span className="scrim-detail__card-header-sub">
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
      <div className="scrim-detail__map-table-card scrim-detail__card--mt">
        <div className="scrim-detail__map-table-header">
          <span className="scrim-detail__card-header-glow">Map History</span>
          <span className="scrim-detail__map-table-sub">Click to view full details</span>
        </div>
        <div className="scrim-detail__map-table-scroll">
          <table className="scrim-detail__map-table">
            <thead>
              <tr>
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
                    className={`scrim-detail__map-th ${mapSortKey === col.key ? 'scrim-detail__map-th--sorted' : ''} ${col.align === 'right' ? 'scrim-detail__map-th--right' : ''}`}
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
                  key={`${m.mapDataId}-${m.hero}`}
                  onClick={() => window.location.href = `/admin/scrim-map?mapId=${m.mapDataId}`}
                  className="scrim-detail__map-row"
                >
                  <td className="scrim-detail__map-td scrim-detail__map-td--map">
                    {m.mapName}
                    <span className="scrim-detail__map-td--type">{m.mapType}</span>
                  </td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--secondary">{m.hero}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--date">{formatDate(m.scrimDate)}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.eliminations}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.deaths}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.finalBlows}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(m.damage)}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(m.healing)}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: m.firstPickPct > 20 ? GREEN : TEXT_PRIMARY, fontWeight: m.firstPickPct > 20 ? 600 : 400 }}>{m.firstPickPct}%</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: m.firstDeathPct > 20 ? RED : TEXT_PRIMARY, fontWeight: m.firstDeathPct > 20 ? 600 : 400 }}>{m.firstDeathPct}%</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.fletaPct}%</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.ultCharge}s</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.kPerUlt}</td>
                  <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.drought}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>}

      {/* ═══════════ Analytics Tab ═══════════ */}
      {activeTab === 'analytics' && renderAnalyticsTab()}

      {/* ═══════════ Charts Tab ═══════════ */}
      {activeTab === 'charts' && renderChartsTab()}

      </div>
    </div>
    </>
  )

  function renderAnalyticsTab() {
    if (!data) return null
    const selHero = data.heroPool.find((h) => h.hero === analyticsHero) ?? data.heroPool[0]
    if (!selHero) return <div style={{ color: TEXT_DIM }}>No hero data available.</div>
    const heroMaps = data.maps.filter((m) => m.hero === selHero.hero)
    // Performance Score: composite of Fleta% (weighted 0.4) + FirstPick% (0.35) − FirstDeath% (0.25)
    const perfScore = Math.max(0, Math.round(
      selHero.avgFletaPct * 0.4 + selHero.avgFirstPickPct * 0.35 - selHero.avgFirstDeathPct * 0.25
    ))
    return (
      <>
        {/* Hero Selector Pill Bar */}
        <div className="scrim-detail__hero-pills">
          {data.heroPool.map((h, idx) => {
            const isActive = h.hero === analyticsHero
            const col = BAR_COLORS[idx % BAR_COLORS.length]
            return (
              <button
                key={h.hero}
                onClick={() => setAnalyticsHero(h.hero)}
                className={`scrim-detail__hero-pill ${isActive ? 'scrim-detail__hero-pill--active' : ''}`}
                style={isActive ? { borderColor: col + '66', color: col, background: `linear-gradient(135deg, ${col}22, ${col}11)`, boxShadow: `0 0 16px ${col}22` } : undefined}
              >
                {h.portrait && <img src={h.portrait} alt={h.hero} />}
                {h.hero}
              </button>
            )
          })}
        </div>

        {/* 4 Stat Cards */}
        <div className="scrim-detail__stat-grid">
          <AnalyticsCard title="Avg Ult Charge Time" value={`${selHero.avgUltChargeTime}s`} icon={<Zap size={20} />}
            desc="Seconds from spawn/last ult to earning next ultimate" color={CYAN} />
          <AnalyticsCard title="Avg Time to Use Ult" value={`${selHero.avgUltHoldTime}s`} icon={<Clock size={20} />}
            desc="How long ultimates are held before being activated" color={PURPLE} />
          <AnalyticsCard title="Avg Drought Time" value={`${selHero.avgDroughtTime}s`} icon={<Skull size={20} />}
            desc="Longest average gap without earning an elimination" color={AMBER} />
          <AnalyticsCard title="Performance Score" value={`${perfScore} pts`} icon={<Trophy size={20} />}
            desc={`Composite score: Fleta% (${selHero.avgFletaPct}%) × 0.4 + FP% (${selHero.avgFirstPickPct}%) × 0.35 − FD% (${selHero.avgFirstDeathPct}%) × 0.25`} color={GREEN} />
        </div>

        {/* Per-Map Trend Table for Selected Hero */}
        <div className="scrim-detail__map-table-card scrim-detail__card--mt">
          <div className="scrim-detail__map-table-header">
            <span className="scrim-detail__card-header-glow">Map-by-Map Analytics</span>
            <span className="scrim-detail__map-table-sub">{heroMaps.length} map{heroMaps.length !== 1 ? 's' : ''} on {selHero.hero}</span>
          </div>
          <div className="scrim-detail__map-table-scroll">
            <table className="scrim-detail__map-table">
              <thead>
                <tr>
                  {['Map', 'Date', 'FP%', 'FD%', 'Fleta%', 'Ult Charge', 'Ult Hold', 'K/Ult', 'Drought', 'Elims', 'Deaths', 'Damage'].map((label) => (
                    <th key={label} className={`scrim-detail__map-th ${label === 'Map' || label === 'Date' ? '' : 'scrim-detail__map-th--right'}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heroMaps.map((m) => (
                  <tr key={m.mapDataId} className="scrim-detail__map-row">
                    <td className="scrim-detail__map-td scrim-detail__map-td--map">
                      {m.mapName} <span className="scrim-detail__map-td--type">{m.mapType}</span>
                    </td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--date">{formatDate(m.scrimDate)}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: m.firstPickPct > 20 ? GREEN : undefined, fontWeight: m.firstPickPct > 20 ? 600 : undefined }}>{m.firstPickPct}%</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: m.firstDeathPct > 20 ? RED : undefined, fontWeight: m.firstDeathPct > 20 ? 600 : undefined }}>{m.firstDeathPct}%</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.fletaPct}%</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.ultCharge}s</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.ultHold}s</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.kPerUlt}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.drought}s</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.eliminations}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{m.deaths}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{formatNumber(m.damage)}</td>
                  </tr>
                ))}
                {heroMaps.length === 0 && (
                  <tr><td colSpan={12} className="scrim-detail__empty">No maps found for {selHero.hero}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Time Split — Donut Chart */}
        {data.roleTimeSplit && Object.values(data.roleTimeSplit).some(v => v > 0) && (
          <div className="scrim-detail__card scrim-detail__card--mt-lg">
            <div className="scrim-detail__label"><Clock size={14} className="scrim-detail__inline-icon" /> Role Time Split</div>
            <div className="scrim-detail__flex-center">
              {/* SVG Donut */}
              <svg width={140} height={140} viewBox="0 0 140 140">
                {(() => {
                  const roles = Object.entries(data.roleTimeSplit).filter(([, v]) => v > 0)
                  const total = roles.reduce((a, [, v]) => a + v, 0)
                  const colors: Record<string, string> = { Tank: CYAN, Damage: RED, Support: GREEN }
                  let offset = 0
                  return roles.map(([role, val]) => {
                    const pct = val / total
                    const dashLen = pct * 2 * Math.PI * 50
                    const dashGap = 2 * Math.PI * 50 - dashLen
                    const r = (
                      <circle
                        key={role}
                        cx={70} cy={70} r={50}
                        fill="none"
                        stroke={colors[role] ?? AMBER}
                        strokeWidth={18}
                        strokeDasharray={`${dashLen} ${dashGap}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 70 70)"
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                      />
                    )
                    offset += dashLen
                    return r
                  })
                })()}
                <text x={70} y={70} textAnchor="middle" dominantBaseline="central" fill={TEXT_PRIMARY} fontSize={14} fontWeight={700}>
                  {formatTime(Object.values(data.roleTimeSplit).reduce((a, v) => a + v, 0))}
                </text>
              </svg>
              {/* Legend */}
              <div className="scrim-detail__legend">
                {Object.entries(data.roleTimeSplit).filter(([, v]) => v > 0).map(([role, val]) => {
                  const total = Object.values(data.roleTimeSplit).reduce((a, v) => a + v, 0)
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
                  const colors: Record<string, string> = { Tank: CYAN, Damage: RED, Support: GREEN }
                  return (
                    <div key={role} className="scrim-detail__legend-item">
                      <div className="scrim-detail__legend-swatch" style={{ background: colors[role] ?? AMBER, boxShadow: `0 0 8px ${(colors[role] ?? AMBER)}44` }} />
                      <span className="scrim-detail__legend-label">{role}</span>
                      <span className="scrim-detail__legend-value">{formatTime(val)} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Map Winrates */}
        {data.mapWinrates.length > 0 && (
          <div className="scrim-detail__card scrim-detail__card--mt-lg">
            <div className="scrim-detail__label"><MapPin size={14} className="scrim-detail__inline-icon" /> Map Winrates</div>
            <div className="scrim-detail__grid-2">
              {/* By Map */}
              <div>
                <div className="scrim-detail__sub-label">BY MAP</div>
                {data.mapWinrates.map(m => {
                  const maxTotal = Math.max(...data.mapWinrates.map(x => x.total))
                  return (
                    <div key={m.map} className="scrim-detail__bar-row">
                      <div className="scrim-detail__bar-label-row">
                        <span className="scrim-detail__bar-name">{m.map}</span>
                        <span style={{ fontSize: '11px', color: m.winrate >= 50 ? GREEN : RED, fontWeight: 600 }}>
                          {m.winrate}% <span className="scrim-detail__bar-detail">({m.wins}W {m.losses}L{m.draws > 0 ? ` ${m.draws}D` : ''})</span>
                        </span>
                      </div>
                      <div className="scrim-detail__progress-track">
                        <div className="scrim-detail__progress-fill" style={{ width: `${(m.total / maxTotal) * 100}%`, background: `linear-gradient(90deg, ${m.winrate >= 50 ? GREEN : RED}66, ${m.winrate >= 50 ? GREEN : RED}33)` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* By Map Type */}
              <div>
                <div className="scrim-detail__sub-label">BY MAP TYPE</div>
                {data.mapTypeWinrates.map(m => {
                  const maxTotal = Math.max(...data.mapTypeWinrates.map(x => x.total))
                  return (
                    <div key={m.mapType} className="scrim-detail__bar-row">
                      <div className="scrim-detail__bar-label-row">
                        <span className="scrim-detail__bar-name">{m.mapType}</span>
                        <span style={{ fontSize: '11px', color: m.winrate >= 50 ? GREEN : RED, fontWeight: 600 }}>
                          {m.winrate}% <span className="scrim-detail__bar-detail">({m.wins}W {m.losses}L{m.draws > 0 ? ` ${m.draws}D` : ''})</span>
                        </span>
                      </div>
                      <div className="scrim-detail__progress-track">
                        <div className="scrim-detail__progress-fill" style={{ width: `${(m.total / maxTotal) * 100}%`, background: `linear-gradient(90deg, ${m.winrate >= 50 ? GREEN : RED}66, ${m.winrate >= 50 ? GREEN : RED}33)` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Hero Matchups — Killed Most / Died To Most */}
        {(data.heroMatchups.killedMost.length > 0 || data.heroMatchups.diedToMost.length > 0) && (
          <div className="scrim-detail__card scrim-detail__card--mt-lg">
            <div className="scrim-detail__label"><Swords size={14} className="scrim-detail__inline-icon" /> Hero Matchups</div>
            <div className="scrim-detail__grid-2-wide">
              {/* Killed Most */}
              <div>
                <div className="scrim-detail__sub-label" style={{ color: GREEN }}>ELIMINATED MOST</div>
                {data.heroMatchups.killedMost.map((m, i) => {
                  const maxCount = data.heroMatchups.killedMost[0]?.count ?? 1
                  return (
                    <div key={m.hero} className="scrim-detail__matchup-row">
                      <span className="scrim-detail__matchup-rank">{i + 1}.</span>
                      <span className="scrim-detail__matchup-name">{m.hero}</span>
                      <div className="scrim-detail__matchup-bar scrim-detail__progress-track">
                        <div className="scrim-detail__progress-fill" style={{ width: `${(m.count / maxCount) * 100}%`, background: `linear-gradient(90deg, ${GREEN}88, ${GREEN}44)` }} />
                      </div>
                      <span className="scrim-detail__matchup-count" style={{ color: GREEN }}>{m.count}</span>
                    </div>
                  )
                })}
              </div>
              {/* Died To Most */}
              <div>
                <div className="scrim-detail__sub-label" style={{ color: RED }}>DIED TO MOST</div>
                {data.heroMatchups.diedToMost.map((m, i) => {
                  const maxCount = data.heroMatchups.diedToMost[0]?.count ?? 1
                  return (
                    <div key={m.hero} className="scrim-detail__matchup-row">
                      <span className="scrim-detail__matchup-rank">{i + 1}.</span>
                      <span className="scrim-detail__matchup-name">{m.hero}</span>
                      <div className="scrim-detail__matchup-bar scrim-detail__progress-track">
                        <div className="scrim-detail__progress-fill" style={{ width: `${(m.count / maxCount) * 100}%`, background: `linear-gradient(90deg, ${RED}88, ${RED}44)` }} />
                      </div>
                      <span className="scrim-detail__matchup-count" style={{ color: RED }}>{m.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Final Blows By Method */}
        {data.finalBlowsByMethod.length > 0 && (
          <div className="scrim-detail__card scrim-detail__card--mt-lg">
            <div className="scrim-detail__label"><Crosshair size={14} className="scrim-detail__inline-icon" /> Final Blows By Method</div>
            {(() => {
              const maxCount = data.finalBlowsByMethod[0]?.count ?? 1
              const total = data.finalBlowsByMethod.reduce((a, m) => a + m.count, 0)
              return data.finalBlowsByMethod.map((m, i) => (
                <div key={m.method} className="scrim-detail__matchup-row">
                  <span className="scrim-detail__matchup-name" style={{ minWidth: '130px' }}>{m.method}</span>
                  <div className="scrim-detail__matchup-bar scrim-detail__progress-track scrim-detail__progress-wide">
                    <div className="scrim-detail__progress-fill" style={{ width: `${(m.count / maxCount) * 100}%`, background: `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}88, ${BAR_COLORS[i % BAR_COLORS.length]}44)` }} />
                  </div>
                  <span className="scrim-detail__matchup-count" style={{ color: BAR_COLORS[i % BAR_COLORS.length], minWidth: '40px' }}>{m.count}</span>
                  <span style={{ fontSize: '10px', color: TEXT_DIM, minWidth: '36px' }}>({total > 0 ? ((m.count / total) * 100).toFixed(1) : 0}%)</span>
                </div>
              ))
            })()}
          </div>
        )}
      </>
    )
  }

  function renderChartsTab() {
    if (!data) return null
    const selHero = data.heroPool.find((h) => h.hero === chartsHero) ?? data.heroPool[0]
    if (!selHero) return <div style={{ color: TEXT_DIM }}>No hero data available.</div>

    // All maps this hero has played on
    const heroMaps = data.maps.filter((m) => m.hero === selHero.hero)

    // Distinct map names for the map selector
    const mapNames = [...new Set(heroMaps.map((m) => m.mapName))]

    // Filter by selected map (or all)
    const filteredMaps = chartsMap === 'all'
      ? heroMaps
      : heroMaps.filter((m) => m.mapName === chartsMap)

    // Sort chronologically by scrim date
    const sortedMaps = [...filteredMaps].sort(
      (a, b) => new Date(a.scrimDate).getTime() - new Date(b.scrimDate).getTime()
    )

    // Build chart data with rich tooltip info
    const chartData = sortedMaps.map((m) => {
      const date = new Date(m.scrimDate)
      const label = chartsMap === 'all'
        ? m.mapName
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return {
        label,
        damage: m.damage,
        finalBlows: m.finalBlows,
        eliminations: m.eliminations,
        healing: m.healing,
        // Rich tooltip context
        tooltip: {
          scrimName: m.scrimName,
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          mapName: m.mapName,
          mapType: m.mapType,
          elims: m.eliminations,
          deaths: m.deaths,
          damage: m.damage,
          healing: m.healing,
          kd: m.deaths > 0 ? (m.eliminations / m.deaths).toFixed(2) : m.eliminations.toString(),
        },
      }
    })

    const isFiltered = chartsMap !== 'all'

    return (
      <>
        {/* Hero Selector Pill Bar */}
        <div className="scrim-detail__hero-pills">
          {data.heroPool.map((h, idx) => {
            const isActive = h.hero === chartsHero
            const col = BAR_COLORS[idx % BAR_COLORS.length]
            return (
              <button
                key={h.hero}
                onClick={() => { setChartsHero(h.hero); setChartsMap('all') }}
                className={`scrim-detail__hero-pill ${isActive ? 'scrim-detail__hero-pill--active' : ''}`}
                style={isActive ? { borderColor: col + '66', color: col, background: `linear-gradient(135deg, ${col}22, ${col}11)`, boxShadow: `0 0 16px ${col}22` } : undefined}
              >
                {h.portrait && <img src={h.portrait} alt={h.hero} />}
                {h.hero}
              </button>
            )
          })}
        </div>

        {/* Map Selector Pill Bar */}
        <div className="scrim-detail__map-selector">
          <button
            onClick={() => setChartsMap('all')}
            className={`scrim-detail__map-pill ${chartsMap === 'all' ? 'scrim-detail__map-pill--active' : ''}`}
          >
            All Maps
          </button>
          {mapNames.map((name) => {
            const isActive = chartsMap === name
            const count = heroMaps.filter((m) => m.mapName === name).length
            return (
              <button
                key={name}
                onClick={() => setChartsMap(name)}
                className={`scrim-detail__map-pill ${isActive ? 'scrim-detail__map-pill--active' : ''}`}
              >
                {name} <span style={{ opacity: 0.5, marginLeft: '4px' }}>({count})</span>
              </button>
            )
          })}
        </div>

        {chartData.length === 0 ? (
          <div className="scrim-detail__card scrim-detail__empty">No data found for {selHero.hero}{chartsMap !== 'all' ? ` on ${chartsMap}` : ''}.</div>
        ) : (
          <div className="scrim-detail__grid-2">
            <InlineSvgChart
              title={isFiltered ? 'Hero Damage Over Time' : 'Hero Damage by Map'}
              color={CYAN}
              data={chartData.map((d) => ({ label: d.label, value: d.damage }))}
              formatter={formatNumber}
              tooltipData={chartData.map((d) => d.tooltip)}
            />
            <InlineSvgChart
              title={isFiltered ? 'Final Blows Over Time' : 'Final Blows by Map'}
              color={GREEN}
              data={chartData.map((d) => ({ label: d.label, value: d.finalBlows }))}
              tooltipData={chartData.map((d) => d.tooltip)}
            />
            <InlineSvgChart
              title={isFiltered ? 'Eliminations Over Time' : 'Eliminations by Map'}
              color={AMBER}
              data={chartData.map((d) => ({ label: d.label, value: d.eliminations }))}
              tooltipData={chartData.map((d) => d.tooltip)}
            />
            <InlineSvgChart
              title={isFiltered ? 'Healing Over Time' : 'Healing by Map'}
              color={PURPLE}
              data={chartData.map((d) => ({ label: d.label, value: d.healing }))}
              formatter={formatNumber}
              tooltipData={chartData.map((d) => d.tooltip)}
            />
          </div>
        )}

        {chartData.length > 0 && (
          <p style={{ color: TEXT_DIM, fontSize: '11px', marginTop: '12px', textAlign: 'center' }}>
            {isFiltered
              ? `Showing ${selHero.hero} on ${chartsMap} across ${chartData.length} scrim${chartData.length !== 1 ? 's' : ''}, sorted by date.`
              : `Showing ${selHero.hero}'s stats across ${chartData.length} map${chartData.length !== 1 ? 's' : ''}.`}
          </p>
        )}

        {/* ── Per-Scrim Trend Chart ── */}
        {data.trendData.length > 1 && (() => {
          const TREND_STATS: Record<string, { label: string; color: string }> = {
            elimsPer10: { label: 'Eliminations /10', color: AMBER },
            fbPer10: { label: 'Final Blows /10', color: GREEN },
            deathsPer10: { label: 'Deaths /10', color: RED },
            damagePer10: { label: 'Damage /10', color: CYAN },
            healingPer10: { label: 'Healing /10', color: PURPLE },
            damageTakenPer10: { label: 'Damage Taken /10', color: '#ec4899' },
            damageBlockedPer10: { label: 'Damage Blocked /10', color: '#6366f1' },
            ultsEarnedPer10: { label: 'Ults Earned /10', color: AMBER },
            soloKillsPer10: { label: 'Solo Kills /10', color: GREEN },
            envKillsPer10: { label: 'Env Kills /10', color: RED },
          }
          const selectedStat = TREND_STATS[trendStat] ?? TREND_STATS.damagePer10
          const trendChartData = data.trendData.map(t => ({
            label: new Date(t.scrimDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: (t as Record<string, unknown>)[trendStat] as number ?? 0,
          }))

          return (
            <div style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, textShadow: `0 0 20px ${selectedStat.color}22` }}>
                  <TrendingUp size={14} className="scrim-detail__inline-icon" /> Per-Scrim Trend — {selectedStat.label}
                </div>
                <select
                  value={trendStat}
                  onChange={e => setTrendStat(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px',
                    padding: '6px 12px', color: TEXT_PRIMARY, fontSize: '12px',
                    cursor: 'pointer', fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  {Object.entries(TREND_STATS).map(([key, { label }]) => (
                    <option key={key} value={key} style={{ background: '#1a1a2e' }}>{label}</option>
                  ))}
                </select>
              </div>
              <InlineSvgChart
                title={selectedStat.label}
                color={selectedStat.color}
                data={trendChartData}
                formatter={trendStat.includes('damage') || trendStat.includes('healing') || trendStat.includes('Damage') || trendStat.includes('Healing') ? formatNumber : undefined}
              />
              <p style={{ color: TEXT_DIM, fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
                Showing {selectedStat.label.toLowerCase()} across {data.trendData.length} scrim{data.trendData.length !== 1 ? 's' : ''}, sorted chronologically.
              </p>
            </div>
          )
        })()}
      </>
    )
  }
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
    <div className="scrim-detail__hero-section" style={{ borderLeft: `3px solid ${color}`, boxShadow: isExpanded ? `0 0 30px ${color}11` : undefined }}>
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
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            display: 'inline-flex',
          }}>
            <ChevronDown size={16} color={TEXT_DIM} />
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
            <StatGroupCard title="Combat" color={RED} stats={[
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

            <StatGroupCard title="Damage & Survivability" color={AMBER} stats={[
              { label: 'All Damage', value: formatNumber(h.allDamageDealt), sub: `${formatNumber(h.damagePer10)} /10` },
              { label: 'Hero Damage', value: formatNumber(h.totalDamage) },
              { label: 'Barrier Damage', value: formatNumber(h.barrierDamageDealt), sub: timeMins > 0 ? `${formatNumber(Math.round(h.barrierDamageDealt / timeMins * 10))} /10` : '—' },
              { label: 'Damage Taken', value: formatNumber(h.damageTaken), sub: timeMins > 0 ? `${formatNumber(Math.round(h.damageTaken / timeMins * 10))} /10` : '—' },
              { label: 'Damage Blocked', value: formatNumber(h.damageBlocked), sub: timeMins > 0 ? `${formatNumber(Math.round(h.damageBlocked / timeMins * 10))} /10` : '—' },
            ]} />

            <StatGroupCard title="Healing & Support" color={GREEN} stats={[
              { label: 'Healing Dealt', value: formatNumber(h.totalHealing), sub: `${formatNumber(h.healingPer10)} /10` },
              { label: 'Healing Received', value: formatNumber(h.healingReceived), sub: timeMins > 0 ? `${formatNumber(Math.round(h.healingReceived / timeMins * 10))} /10` : '—' },
              { label: 'Self Healing', value: formatNumber(h.selfHealing), sub: timeMins > 0 ? `${formatNumber(Math.round(h.selfHealing / timeMins * 10))} /10` : '—' },
              { label: 'Def. Assists', value: String(h.defensiveAssists), sub: timeMins > 0 ? `${formatDecimal(h.defensiveAssists / timeMins * 10)} /10` : '—' },
              { label: 'Off. Assists', value: String(h.offensiveAssists), sub: timeMins > 0 ? `${formatDecimal(h.offensiveAssists / timeMins * 10)} /10` : '—' },
            ]} />

            <StatGroupCard title="Ultimates" color={PURPLE} stats={[
              { label: 'Ults Earned', value: String(h.ultimatesEarned), sub: `${formatDecimal(h.ultsPer10)} /10` },
              { label: 'Ults Used', value: String(h.ultimatesUsed), sub: `${formatDecimal(h.ultsPer10)} /10` },
              { label: 'Avg Charge Time', value: `${h.avgUltChargeTime}s` },
              { label: 'Kills / Ult', value: formatDecimal(h.avgKillsPerUlt) },
              { label: 'Avg Hold Time', value: `${h.avgUltHoldTime}s`, sub: 'Charged → used' },
            ]} />

            <StatGroupCard title="Accuracy" color={CYAN} stats={[
              { label: 'Weapon Accuracy', value: formatPct(h.weaponAccuracy) },
              { label: 'Crit Accuracy', value: formatPct(h.criticalHitAccuracy) },
              { label: 'Critical Hits', value: String(h.criticalHits), sub: timeMins > 0 ? `${formatDecimal(h.criticalHits / timeMins * 10)} /10` : '—' },
              ...(h.scopedAccuracy > 0 ? [{ label: 'Scoped Accuracy', value: formatPct(h.scopedAccuracy) }] : []),
            ]} />

            <StatGroupCard title="Performance" color={GREEN} stats={[
              { label: 'Fleta Deadlift', value: `${h.avgFletaPct}%`, sub: 'Earns 50%+ of team final blows' },
              { label: 'First Pick', value: `${h.avgFirstPickPct}%`, sub: `Across ${h.mapsPlayed} map${h.mapsPlayed !== 1 ? 's' : ''}` },
              { label: 'First Death', value: `${h.avgFirstDeathPct}%`, sub: h.avgFirstDeathPct > 20 ? 'High — watch positioning' : 'Healthy' },
            ]} />

            <StatGroupCard title="Per 10 Min Overview" color={TEXT_SECONDARY} stats={[
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

function SummaryCard({ label, value, sub, accentColor, icon }: { label: string; value: string; sub: string; accentColor?: string; icon?: React.ReactNode }) {
  const ac = accentColor ?? CYAN
  return (
    <div className="scrim-detail__summary-card" style={{ borderTop: `2px solid ${ac}` }}>
      <div className="scrim-detail__summary-glow" style={{ background: `radial-gradient(circle at 80% 0%, ${ac}0c 0%, transparent 70%)` }} />
      <div className="scrim-detail__summary-label">
        {icon && <span className="scrim-detail__summary-icon">{icon}</span>}
        {label}
      </div>
      <div className="scrim-detail__summary-value" style={{ color: ac, textShadow: `0 0 20px ${ac}44` }}>
        {value}
      </div>
      <div className="scrim-detail__summary-sub">{sub}</div>
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

/** Analytics stat card — icon, large value, small descriptive text */
function AnalyticsCard({ title, value, icon, desc, color }: { title: string; value: string; icon: React.ReactNode; desc: string; color: string }) {
  return (
    <div className="scrim-detail__analytics-card" style={{ borderColor: `${color}22` }}>
      <div className="scrim-detail__analytics-glow" style={{ background: `linear-gradient(90deg, transparent, ${color}44, transparent)` }} />
      <div className="scrim-detail__analytics-header">
        <span className="scrim-detail__analytics-icon">{icon}</span>
        <span className="scrim-detail__analytics-title">{title}</span>
      </div>
      <div className="scrim-detail__analytics-value" style={{ color, textShadow: `0 0 20px ${color}33` }}>
        {value}
      </div>
      <p className="scrim-detail__analytics-desc">{desc}</p>
    </div>
  )
}

/** Inline SVG line + area chart — zero-dependency, Clean Glow styled */
type TooltipInfo = {
  scrimName: string
  date: string
  mapName: string
  mapType: string
  elims: number
  deaths: number
  damage: number
  healing: number
  kd: string
}

function InlineSvgChart({ title, color, data, formatter, tooltipData }: {
  title: string
  color: string
  data: { label: string; value: number }[]
  formatter?: (n: number) => string
  tooltipData?: TooltipInfo[]
}) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const fmt = formatter ?? ((n: number) => n.toString())

  if (data.length === 0) return null

  const W = 600, H = 280, PAD_L = 70, PAD_R = 24, PAD_TOP = 36, PAD_BOT = 48
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_TOP - PAD_BOT
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  // Keep minVal at 0 for cleaner baselines, unless there are negative values
  const minVal = Math.min(...data.map((d) => d.value), 0)
  const range = maxVal - minVal || 1
  // Add 10% padding to top of range so points don't touch the ceiling
  const paddedMax = maxVal + range * 0.1
  const paddedRange = paddedMax - minVal || 1

  const points = data.map((d, i) => ({
    x: PAD_L + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: PAD_TOP + chartH - ((d.value - minVal) / paddedRange) * chartH,
    ...d,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${PAD_TOP + chartH} L ${points[0].x} ${PAD_TOP + chartH} Z`

  // Horizontal grid lines (5 lines: 0%, 25%, 50%, 75%, 100%)
  const GRID_COUNT = 5
  const gridLines = Array.from({ length: GRID_COUNT }, (_, i) => {
    const frac = i / (GRID_COUNT - 1)
    return {
      y: PAD_TOP + chartH * (1 - frac),
      val: Math.round(minVal + frac * paddedRange),
    }
  })

  const gradId = `grad-${title.replace(/\s+/g, '-')}-${color.replace('#', '')}`

  return (
    <div className="scrim-detail__chart-card">
      <div className="scrim-detail__chart-header">
        <div className="scrim-detail__chart-swatch" style={{ background: color, boxShadow: `0 0 8px ${color}66` }} />
        <span className="scrim-detail__card-header-glow" style={{ textShadow: `0 0 20px ${color}33` }}>{title}</span>
        <span className="scrim-detail__chart-count">{data.length} map{data.length !== 1 ? 's' : ''}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: '280px' }} preserveAspectRatio="xMidYMid meet">
        {/* Background */}
        <rect x={PAD_L} y={PAD_TOP} width={chartW} height={chartH} fill="rgba(255,255,255,0.015)" rx={4} />

        {/* Grid lines + Y-axis labels */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={g.y} x2={PAD_L + chartW} y2={g.y}
              stroke={i === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={i === 0 ? 1.5 : 1}
              strokeDasharray={i === 0 ? undefined : '4 4'} />
            <text x={PAD_L - 10} y={g.y + 4} fill={TEXT_SECONDARY} fontSize={12} textAnchor="end" fontFamily="'Inter', sans-serif" fontWeight={500}>
              {fmt(g.val)}
            </text>
          </g>
        ))}

        {/* Y-axis line */}
        <line x1={PAD_L} y1={PAD_TOP} x2={PAD_L} y2={PAD_TOP + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

        {/* Area fill gradient */}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="70%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Main line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

        {/* Glow line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" opacity={0.2} style={{ filter: 'blur(6px)' }} />

        {/* Data points + X labels + value labels */}
        {points.map((p, i) => (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Vertical guide on hover */}
            {hovered === i && (
              <line x1={p.x} y1={PAD_TOP} x2={p.x} y2={PAD_TOP + chartH} stroke={`${color}33`} strokeWidth={1} strokeDasharray="3 3" />
            )}
            {/* Hit area */}
            <circle cx={p.x} cy={p.y} r={20} fill="transparent" />

            {/* Outer ring */}
            <circle cx={p.x} cy={p.y} r={hovered === i ? 10 : 6} fill="none" stroke={`${color}44`} strokeWidth={1.5}
              style={{ transition: 'all 0.2s' }} />
            {/* Inner dot */}
            <circle cx={p.x} cy={p.y} r={hovered === i ? 6 : 4} fill={color}
              style={{ transition: 'all 0.2s', filter: `drop-shadow(0 0 ${hovered === i ? 10 : 4}px ${color})` }} />

            {/* Value label above dot (always visible) */}
            <text x={p.x} y={p.y - 16} fill={hovered === i ? TEXT_PRIMARY : `${color}cc`} fontSize={12} textAnchor="middle"
              fontWeight={700} fontFamily="'Inter', sans-serif" style={{ transition: 'fill 0.2s' }}>
              {fmt(p.value)}
            </text>

            {/* X-axis label */}
            <text x={p.x} y={PAD_TOP + chartH + 20} fill={hovered === i ? TEXT_PRIMARY : TEXT_DIM} fontSize={11}
              textAnchor="middle" fontFamily="'Inter', sans-serif" fontWeight={hovered === i ? 600 : 400}
              style={{ transition: 'fill 0.2s' }}>
              {p.label.length > 14 ? p.label.slice(0, 12) + '…' : p.label}
            </text>

            {/* Hover tooltip */}
            {hovered === i && (() => {
              const tip = tooltipData?.[i]
              if (tip) {
                // Rich tooltip with scrim context
                const boxW = 180, boxH = 80
                // Position tooltip to the right by default, flip if near right edge
                const tipX = p.x + 16 + boxW > W ? p.x - boxW - 16 : p.x + 16
                const tipY = Math.max(4, Math.min(p.y - boxH / 2, H - boxH - 4))
                return (
                  <g>
                    <rect x={tipX} y={tipY} width={boxW} height={boxH} rx={8}
                      fill="rgba(8, 10, 22, 0.96)" stroke={`${color}55`} strokeWidth={1.5} />
                    {/* Scrim name */}
                    <text x={tipX + 10} y={tipY + 16} fill={color} fontSize={11} fontWeight={700} fontFamily="'Inter', sans-serif">
                      {tip.scrimName.length > 22 ? tip.scrimName.slice(0, 20) + '…' : tip.scrimName}
                    </text>
                    {/* Date + Map type */}
                    <text x={tipX + 10} y={tipY + 30} fill={TEXT_DIM} fontSize={9} fontFamily="'Inter', sans-serif">
                      {tip.date} · {tip.mapType}
                    </text>
                    {/* Divider */}
                    <line x1={tipX + 10} y1={tipY + 36} x2={tipX + boxW - 10} y2={tipY + 36} stroke="rgba(255,255,255,0.08)" />
                    {/* Stats row */}
                    <text x={tipX + 10} y={tipY + 52} fill={TEXT_SECONDARY} fontSize={9} fontFamily="'Inter', sans-serif">
                      K/D: <tspan fill={TEXT_PRIMARY} fontWeight={700}>{tip.kd}</tspan>
                      {'  '}E: <tspan fill={TEXT_PRIMARY} fontWeight={700}>{tip.elims}</tspan>
                      {'  '}D: <tspan fill={TEXT_PRIMARY} fontWeight={700}>{tip.deaths}</tspan>
                    </text>
                    <text x={tipX + 10} y={tipY + 66} fill={TEXT_SECONDARY} fontSize={9} fontFamily="'Inter', sans-serif">
                      Dmg: <tspan fill={CYAN} fontWeight={700}>{formatNumber(tip.damage)}</tspan>
                      {'  '}Heal: <tspan fill={GREEN} fontWeight={700}>{formatNumber(tip.healing)}</tspan>
                    </text>
                  </g>
                )
              }
              // Simple tooltip fallback
              return (
                <g>
                  <rect x={p.x - 50} y={p.y - 44} width={100} height={24} rx={6}
                    fill="rgba(10, 14, 26, 0.95)" stroke={`${color}66`} strokeWidth={1.5} />
                  <text x={p.x} y={p.y - 28} fill={TEXT_PRIMARY} fontSize={12} textAnchor="middle" fontWeight={700} fontFamily="'Inter', sans-serif">
                    {fmt(p.value)} — {p.label}
                  </text>
                </g>
              )
            })()}
          </g>
        ))}
      </svg>
    </div>
  )
}
