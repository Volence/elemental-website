'use client'

import React, { useState, useEffect } from 'react'
import RangeFilter, { type RangeValue } from '@/components/RangeFilter'

// ── Types ──
interface TopHero { hero: string; time: number }
interface RosterPlayer {
  personId: number; name: string; mapsPlayed: number; totalTime: number
  elimsPer10: number; deathsPer10: number; damagePer10: number; healingPer10: number
  fbPer10: number; kd: number; topHeroes: TopHero[]
}
interface MapStat {
  mapName: string; mapType: string; wins: number; losses: number; draws: number
  played: number; winRate: number; avgTime: number | null
}
interface Opponent {
  name: string; wins: number; losses: number; draws: number
  totalMaps: number; winRate: number; lastPlayed: string | null
}
interface ScrimMapResult {
  mapDataId: number; mapName: string; mapType: string
  opponent: string; score: string | null; result: 'win' | 'loss' | 'draw' | null
}
interface RecentScrim {
  id: number; name: string; date: string; mapCount: number
  record: { wins: number; losses: number; draws: number }
  maps: ScrimMapResult[]
}
// New types
interface WeeklyWinRate { week: string; wins: number; losses: number; draws: number; total: number; winRate: number }
interface RecentFormEntry { mapName: string; mapType: string; opponent: string; result: string | null; score: string | null; date: string }
interface Streaks { current: number; currentType: 'win' | 'loss' | null; longestWin: number; longestLoss: number }
interface HeroPoolEntry { hero: string; role: string; totalTime: number; mapsPlayed: number; wins: number; losses: number; draws: number; winRate: number }
interface RolePerf { role: string; totalTime: number; mapsPlayed: number; kd: number; damagePer10: number; healingPer10: number; deathsPer10: number; elimsPer10: number; ultEfficiency: number; totalElims: number; totalDeaths: number; ultsEarned: number; ultsUsed: number }
interface PlayerMapEntry { personId: number; playerName: string; mapName: string; wins: number; losses: number; draws: number; totalMaps: number; winRate: number }
interface StrengthEntry { mapName: string; mapType: string; winRate: number; played: number }

interface TeamData {
  teamId: number; teamName: string; totalScrims: number; totalMaps: number
  record: { wins: number; losses: number; draws: number }
  winRate: number; avgMatchTime: number | null
  recentScrims: RecentScrim[]; mapStats: MapStat[]; roster: RosterPlayer[]; opponents: Opponent[]
  trends: { weeklyWinRates: WeeklyWinRate[]; recentForm: RecentFormEntry[]; streaks: Streaks }
  heroes: { totalUnique: number; diversityScore: number; heroPool: HeroPoolEntry[]; roleBreakdown: { Tank: number; Damage: number; Support: number } }
  teamfights: { totalFights: number; fightWinRate: number; firstPickWinRate: number; firstDeathWinRate: number; avgFightDuration: number; firstPickTotal: number; firstDeathTotal: number; fightsWon: number }
  rolePerformance: RolePerf[]
  playerMapMatrix: PlayerMapEntry[]
  strengths: { best: StrengthEntry | null; worst: StrengthEntry | null }
}

type TabId = 'overview' | 'maps' | 'roster' | 'opponents' | 'trends' | 'heroes' | 'teamfights'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'maps', label: 'Maps' },
  { id: 'roster', label: 'Roster' },
  { id: 'opponents', label: 'Opponents' },
  { id: 'trends', label: 'Trends' },
  { id: 'heroes', label: 'Heroes' },
  { id: 'teamfights', label: 'Teamfights' },
]

// ── Clean Glow Design Tokens ──
const BG_BASE = '#0a0e1a'
const BG_CARD = '#0f1629'
const BG_CARD_HOVER = '#141c35'
const BORDER = '#1e293b'
const BORDER_GLOW = '#06b6d422'
const TEXT_PRIMARY = '#e2e8f0'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_DIM = '#64748b'
const CYAN = '#06b6d4'
const GREEN = '#10b981'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const PURPLE = '#a855f7'
const BLUE = '#3b82f6'
const PINK = '#ec4899'

const cardStyle: React.CSSProperties = {
  background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px',
}
const glowCardStyle: React.CSSProperties = {
  ...cardStyle, boxShadow: `0 0 20px ${BORDER_GLOW}`,
}
const RESULT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  win: { bg: `${GREEN}18`, text: GREEN, label: 'W' },
  loss: { bg: `${RED}18`, text: RED, label: 'L' },
  draw: { bg: `${AMBER}18`, text: AMBER, label: 'D' },
}
const ROLE_COLORS: Record<string, string> = { Tank: BLUE, Damage: RED, Support: GREEN }

// ── Helpers ──
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Component ──
export default function ScrimTeamDetailView() {
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [range, setRange] = useState<RangeValue>('last20')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const teamId = params.get('teamId')
    if (!teamId) { setError('No teamId specified'); setLoading(false); return }

    fetch(`/api/scrim-team-stats?teamId=${teamId}&range=${range}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json() })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', color: TEXT_SECONDARY }}>Loading team stats…</div>
  if (error) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', color: RED }}>{error}</div>
  if (!data) return null

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <a href="/admin/scrims" style={{ color: TEXT_DIM, textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>← Back to Scrims</a>
            <h1 style={{ color: TEXT_PRIMARY, fontSize: '28px', fontWeight: 700, margin: '8px 0 0', letterSpacing: '-0.5px' }}>{data.teamName}</h1>
            <p style={{ color: TEXT_SECONDARY, fontSize: '14px', margin: '4px 0 0' }}>
              {data.totalScrims} scrim{data.totalScrims !== 1 ? 's' : ''} · {data.totalMaps} map{data.totalMaps !== 1 ? 's' : ''}
            </p>
          </div>
          <RangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            background: 'transparent', border: 'none', borderBottom: tab === t.id ? `2px solid ${CYAN}` : '2px solid transparent',
            color: tab === t.id ? CYAN : TEXT_SECONDARY, transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'maps' && <MapsTab data={data} />}
      {tab === 'roster' && <RosterTab data={data} />}
      {tab === 'opponents' && <OpponentsTab data={data} />}
      {tab === 'trends' && <TrendsTab data={data} />}
      {tab === 'heroes' && <HeroesTab data={data} />}
      {tab === 'teamfights' && <TeamfightsTab data={data} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── Overview Tab (Enhanced: radar, first pick, strengths) ──
// ════════════════════════════════════════════════════════════════
function OverviewTab({ data }: { data: TeamData }) {
  const { record, winRate, avgMatchTime, recentScrims, strengths, teamfights, rolePerformance } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <SummaryCard label="Record" value={`${record.wins}-${record.losses}-${record.draws}`} sub="W-L-D" color={CYAN} />
        <SummaryCard label="Win Rate" value={`${winRate}%`} sub={`${record.wins + record.losses + record.draws} maps`} color={winRate >= 50 ? GREEN : RED} />
        <SummaryCard label="Fight Win %" value={`${teamfights.fightWinRate}%`} sub={`${teamfights.totalFights} fights`} color={teamfights.fightWinRate >= 50 ? GREEN : RED} />
        <SummaryCard label="First Pick Win %" value={`${teamfights.firstPickWinRate}%`} sub={`${teamfights.firstPickTotal} first picks`} color={teamfights.firstPickWinRate >= 50 ? GREEN : AMBER} />
        <SummaryCard label="Avg Match" value={avgMatchTime ? formatTime(avgMatchTime) : '—'} sub="per map" color={CYAN} />
      </div>

      {/* Role Balance Radar + Strengths side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Role Balance Radar */}
        <div style={glowCardStyle}>
          <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Role Balance</h3>
          <RoleRadar rolePerformance={rolePerformance} />
        </div>

        {/* Strengths & Weaknesses */}
        <div style={glowCardStyle}>
          <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Strengths & Weaknesses</h3>
          {strengths.best && (
            <div style={{ padding: '12px', background: `${GREEN}10`, borderRadius: '8px', marginBottom: '10px', border: `1px solid ${GREEN}22` }}>
              <div style={{ color: GREEN, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Best Map</div>
              <div style={{ color: TEXT_PRIMARY, fontSize: '16px', fontWeight: 700 }}>{strengths.best.mapName}</div>
              <div style={{ color: TEXT_SECONDARY, fontSize: '12px' }}>{strengths.best.winRate}% win rate · {strengths.best.played} played · {strengths.best.mapType}</div>
            </div>
          )}
          {strengths.worst && (
            <div style={{ padding: '12px', background: `${RED}10`, borderRadius: '8px', border: `1px solid ${RED}22` }}>
              <div style={{ color: RED, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Worst Map</div>
              <div style={{ color: TEXT_PRIMARY, fontSize: '16px', fontWeight: 700 }}>{strengths.worst.mapName}</div>
              <div style={{ color: TEXT_SECONDARY, fontSize: '12px' }}>{strengths.worst.winRate}% win rate · {strengths.worst.played} played · {strengths.worst.mapType}</div>
            </div>
          )}
          {!strengths.best && !strengths.worst && (
            <div style={{ color: TEXT_DIM, fontSize: '13px' }}>Not enough data for analysis</div>
          )}
          {/* First Death Recovery */}
          <div style={{ marginTop: '12px', padding: '12px', background: `${AMBER}08`, borderRadius: '8px', border: `1px solid ${AMBER}18` }}>
            <div style={{ color: AMBER, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>First Death Recovery</div>
            <div style={{ color: TEXT_PRIMARY, fontSize: '16px', fontWeight: 700 }}>{teamfights.firstDeathWinRate}%</div>
            <div style={{ color: TEXT_SECONDARY, fontSize: '12px' }}>Win rate after suffering first death ({teamfights.firstDeathTotal} fights)</div>
          </div>
        </div>
      </div>

      {/* Recent Scrims */}
      <div style={cardStyle}>
        <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Recent Scrims</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentScrims.map(s => {
            const firstMapId = s.maps[0]?.mapDataId
            const href = firstMapId ? `/admin/scrim-map?mapId=${firstMapId}` : '/admin/scrims'
            return (
              <a key={s.id} href={href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: BG_BASE, borderRadius: '8px', textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = BG_CARD_HOVER)} onMouseLeave={e => (e.currentTarget.style.background = BG_BASE)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: TEXT_PRIMARY, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ color: TEXT_DIM, fontSize: '11px' }}>{formatDate(s.date)}</div>
                </div>
                <div style={{ color: TEXT_SECONDARY, fontSize: '13px', fontWeight: 600 }}>{s.record.wins}-{s.record.losses}-{s.record.draws}</div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {s.maps.map((m, i) => {
                    const c = m.result ? RESULT_COLORS[m.result] : null
                    return <span key={i} title={`${m.mapName}: ${m.score ?? '?'}`} style={{ width: '20px', height: '20px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, background: c?.bg ?? `${TEXT_DIM}22`, color: c?.text ?? TEXT_DIM }}>{c?.label ?? '?'}</span>
                  })}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Role Balance Radar (SVG) ──
function RoleRadar({ rolePerformance }: { rolePerformance: RolePerf[] }) {
  if (rolePerformance.length === 0) return <div style={{ color: TEXT_DIM, fontSize: '13px' }}>No role data</div>

  const activeRoles = rolePerformance.filter(rp => rp.totalTime > 0)
  if (activeRoles.length === 0) return <div style={{ color: TEXT_DIM, fontSize: '13px' }}>No role data</div>

  // Axes: top=K/D, right=Dmg/10, bottom=Survivability, left=Heals/10
  const axes = ['K/D', 'Dmg/10', 'Survivability', 'Heals/10']
  const w = 360, h = 340
  const cx = w / 2, cy = 145, radius = 95
  const roles = ['Tank', 'Damage', 'Support']

  // Normalize values to 0-1 range with a minimum baseline so polygons are always visible
  const getValues = (role: string) => {
    const r = rolePerformance.find(rp => rp.role === role)
    if (!r || r.totalTime === 0) return null // Return null for missing roles
    const maxKd = Math.max(...activeRoles.map(rp => rp.kd), 1)
    const maxDmg = Math.max(...activeRoles.map(rp => rp.damagePer10), 1)
    const maxDeaths = Math.max(...activeRoles.map(rp => rp.deathsPer10), 1)
    const maxHeals = Math.max(...activeRoles.map(rp => rp.healingPer10), 1)

    const minVal = 0.15 // Minimum so axes don't collapse to center
    return [
      Math.max(r.kd / maxKd, minVal),
      Math.max(r.damagePer10 / maxDmg, minVal),
      Math.max(maxDeaths > 0 ? 1 - (r.deathsPer10 / (maxDeaths * 1.2)) : 0.5, minVal),
      Math.max(r.healingPer10 / maxHeals, minVal),
    ]
  }

  const angleStep = (2 * Math.PI) / axes.length
  const getPoint = (i: number, v: number) => ({
    x: cx + radius * v * Math.cos(i * angleStep - Math.PI / 2),
    y: cy + radius * v * Math.sin(i * angleStep - Math.PI / 2),
  })

  const rings = [0.25, 0.5, 0.75, 1]
  const gridColor = '#334155'

  // Per-axis label anchors so they don't clip edges
  const labelProps = (i: number) => {
    // 0=top, 1=right, 2=bottom, 3=left
    const anchors: Array<'middle' | 'start' | 'end'> = ['middle', 'start', 'middle', 'end']
    const dyOffsets = [-6, 0, 8, 0] // push top up, bottom down
    return { textAnchor: anchors[i], dy: dyOffsets[i] }
  }

  return (
    <div style={{ width: '100%', minHeight: '320px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <svg viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '360px', height: '340px', flexShrink: 0 }}>
      {/* Background glow */}
      <circle cx={cx} cy={cy} r={radius + 4} fill="none" stroke={`${CYAN}08`} strokeWidth="8" />

      {/* Grid rings */}
      {rings.map(r => (
        <polygon key={r} points={axes.map((_, i) => { const p = getPoint(i, r); return `${p.x},${p.y}` }).join(' ')}
          fill="none" stroke={gridColor} strokeWidth="1" opacity={r === 1 ? 0.6 : 0.35} />
      ))}
      {/* Axis lines */}
      {axes.map((_, i) => {
        const p = getPoint(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={gridColor} strokeWidth="1" opacity="0.4" />
      })}

      {/* Role polygons — only render roles that have data */}
      {roles.map(role => {
        const values = getValues(role)
        if (!values) return null
        const points = values.map((v, i) => { const p = getPoint(i, v); return `${p.x},${p.y}` }).join(' ')
        const color = ROLE_COLORS[role] ?? CYAN
        return <polygon key={role} points={points} fill={`${color}55`} stroke={color} strokeWidth="2.5" opacity="0.9" />
      })}

      {/* Data points on polygon vertices */}
      {roles.map(role => {
        const values = getValues(role)
        if (!values) return null
        const color = ROLE_COLORS[role] ?? CYAN
        return values.map((v, i) => {
          const p = getPoint(i, v)
          return <circle key={`${role}-${i}`} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.9" />
        })
      })}

      {/* Axis labels — positioned with per-axis anchoring */}
      {axes.map((label, i) => {
        const p = getPoint(i, 1.22)
        const { textAnchor, dy } = labelProps(i)
        return <text key={i} x={p.x} y={p.y + dy} textAnchor={textAnchor} dominantBaseline="middle" fill={TEXT_PRIMARY} fontSize="11" fontWeight="600">{label}</text>
      })}

      {/* Legend — well below the chart */}
      {roles.map((role, i) => {
        const hasData = getValues(role) !== null
        return (
          <g key={role} transform={`translate(${65 + i * 85}, 315)`} opacity={hasData ? 1 : 0.35}>
            <circle cx="0" cy="0" r="5" fill={ROLE_COLORS[role]} opacity={hasData ? 0.9 : 0.4} />
            <text x="10" y="0" dominantBaseline="middle" fill={hasData ? TEXT_PRIMARY : TEXT_DIM} fontSize="11" fontWeight="500">{role}</text>
          </g>
        )
      })}
    </svg>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── Maps Tab (Enhanced: player×map matrix) ──
// ════════════════════════════════════════════════════════════════
function MapsTab({ data }: { data: TeamData }) {
  const [sortKey, setSortKey] = useState<'mapName' | 'played' | 'winRate'>('played')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }
  const arrow = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const sorted = [...data.mapStats].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'mapName') return mul * a.mapName.localeCompare(b.mapName)
    return mul * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0))
  })

  // Player×Map matrix
  const players = [...new Map(data.playerMapMatrix.map(pm => [pm.personId, pm.playerName])).entries()]
  const mapNames = [...new Set(data.playerMapMatrix.map(pm => pm.mapName))]
  const matrixLookup = new Map(data.playerMapMatrix.map(pm => [`${pm.personId}__${pm.mapName}`, pm]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Map table */}
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Map Performance</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['mapName', 'played', 'winRate'].map(k => (
                <th key={k} onClick={() => handleSort(k as typeof sortKey)} style={{ padding: '8px 12px', textAlign: k === 'mapName' ? 'left' : 'center', color: TEXT_SECONDARY, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '12px' }}>
                  {k === 'mapName' ? 'Map' : k === 'played' ? 'Played' : 'Win %'}{arrow(k)}
                </th>
              ))}
              <th style={{ padding: '8px 12px', textAlign: 'center', color: TEXT_SECONDARY, fontWeight: 600, fontSize: '12px' }}>Record</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: TEXT_SECONDARY, fontWeight: 600, fontSize: '12px' }}>Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: TEXT_SECONDARY, fontWeight: 600, fontSize: '12px' }}>Avg Time</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(m => (
              <tr key={m.mapName} style={{ borderBottom: `1px solid ${BORDER}44` }}>
                <td style={{ padding: '10px 12px', color: TEXT_PRIMARY, fontWeight: 600 }}>{m.mapName}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: TEXT_SECONDARY }}>{m.played}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{ color: m.winRate >= 50 ? GREEN : m.winRate > 0 ? RED : TEXT_DIM, fontWeight: 600 }}>{m.winRate}%</span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: TEXT_SECONDARY }}>{m.wins}-{m.losses}-{m.draws}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: TEXT_DIM, fontSize: '12px' }}>{m.mapType}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: TEXT_DIM }}>{m.avgTime ? formatTime(m.avgTime) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Player × Map Matrix */}
      {players.length > 0 && mapNames.length > 0 && (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Player × Map Win Rate</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 600, position: 'sticky', left: 0, background: BG_CARD }}>Player</th>
                {mapNames.map(mn => <th key={mn} style={{ padding: '6px 8px', textAlign: 'center', color: TEXT_SECONDARY, fontWeight: 500, whiteSpace: 'nowrap', fontSize: '11px' }}>{mn}</th>)}
              </tr>
            </thead>
            <tbody>
              {players.map(([pid, pname]) => (
                <tr key={pid} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                  <td style={{ padding: '6px 10px', color: TEXT_PRIMARY, fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: BG_CARD, fontSize: '12px' }}>{pname}</td>
                  {mapNames.map(mn => {
                    const entry = matrixLookup.get(`${pid}__${mn}`)
                    if (!entry || entry.totalMaps === 0) return <td key={mn} style={{ padding: '6px 8px', textAlign: 'center', color: TEXT_DIM }}>—</td>
                    const wr = entry.winRate
                    const bg = wr >= 60 ? `${GREEN}18` : wr >= 40 ? `${AMBER}12` : `${RED}18`
                    const fg = wr >= 60 ? GREEN : wr >= 40 ? AMBER : RED
                    return <td key={mn} style={{ padding: '6px 8px', textAlign: 'center', background: bg, color: fg, fontWeight: 600 }}>{wr}%</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── Roster Tab (Enhanced: role performance cards) ──
// ════════════════════════════════════════════════════════════════
function RosterTab({ data }: { data: TeamData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Role Performance Cards */}
      {data.rolePerformance.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {data.rolePerformance.map(r => (
            <div key={r.role} style={{ ...glowCardStyle, borderLeft: `3px solid ${ROLE_COLORS[r.role] ?? CYAN}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROLE_COLORS[r.role] ?? CYAN }} />
                <span style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 700 }}>{r.role}</span>
                <span style={{ color: TEXT_DIM, fontSize: '11px', marginLeft: 'auto' }}>{r.mapsPlayed} maps</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <MiniStat label="K/D" value={String(r.kd)} color={r.kd >= 1.5 ? GREEN : r.kd >= 1 ? AMBER : RED} />
                <MiniStat label="Elims/10" value={String(r.elimsPer10)} color={CYAN} />
                <MiniStat label="Deaths/10" value={String(r.deathsPer10)} color={r.deathsPer10 <= 5 ? GREEN : AMBER} />
                <MiniStat label="Dmg/10" value={r.damagePer10.toLocaleString()} color={PURPLE} />
                <MiniStat label="Heal/10" value={r.healingPer10.toLocaleString()} color={GREEN} />
                <MiniStat label="Ult Eff" value={String(r.ultEfficiency)} color={BLUE} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Player Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {data.roster.map(p => (
          <a key={p.personId} href={`/admin/scrim-player-detail?personId=${p.personId}`} style={{ ...cardStyle, textDecoration: 'none', transition: 'border-color 0.2s, background 0.2s', cursor: 'pointer' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = `${CYAN}44`; e.currentTarget.style.background = BG_CARD_HOVER }}
            onMouseOut={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = BG_CARD }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 700 }}>{p.name}</span>
              <span style={{ color: TEXT_DIM, fontSize: '11px' }}>{p.mapsPlayed} maps</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
              <MiniStat label="K/D" value={String(p.kd)} color={p.kd >= 1.5 ? GREEN : AMBER} />
              <MiniStat label="Elims/10" value={String(p.elimsPer10)} color={CYAN} />
              <MiniStat label="Deaths/10" value={String(p.deathsPer10)} color={TEXT_SECONDARY} />
              <MiniStat label="Dmg/10" value={p.damagePer10.toLocaleString()} color={PURPLE} />
              <MiniStat label="Heal/10" value={p.healingPer10.toLocaleString()} color={GREEN} />
              <MiniStat label="FB/10" value={String(p.fbPer10)} color={AMBER} />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {p.topHeroes.map(h => (
                <span key={h.hero} style={{ padding: '2px 8px', background: `${CYAN}12`, borderRadius: '4px', color: CYAN, fontSize: '11px', fontWeight: 500 }}>{h.hero}</span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── Opponents Tab (unchanged) ──
// ════════════════════════════════════════════════════════════════
function OpponentsTab({ data }: { data: TeamData }) {
  const [sortKey, setSortKey] = useState<'name' | 'totalMaps' | 'winRate'>('totalMaps')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }
  const arrow = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const sorted = [...data.opponents].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'name') return mul * a.name.localeCompare(b.name)
    return mul * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0))
  })

  return (
    <div style={cardStyle}>
      <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Opponent History</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {['name', 'totalMaps', 'winRate'].map(k => (
              <th key={k} onClick={() => handleSort(k as typeof sortKey)} style={{ padding: '8px 12px', textAlign: k === 'name' ? 'left' : 'center', color: TEXT_SECONDARY, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '12px' }}>
                {k === 'name' ? 'Opponent' : k === 'totalMaps' ? 'Maps' : 'Win %'}{arrow(k)}
              </th>
            ))}
            <th style={{ padding: '8px 12px', textAlign: 'center', color: TEXT_SECONDARY, fontWeight: 600, fontSize: '12px' }}>Record</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', color: TEXT_SECONDARY, fontWeight: 600, fontSize: '12px' }}>Last Played</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(o => (
            <tr key={o.name} style={{ borderBottom: `1px solid ${BORDER}44` }}>
              <td style={{ padding: '10px 12px', color: TEXT_PRIMARY, fontWeight: 600 }}>{o.name}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: TEXT_SECONDARY }}>{o.totalMaps}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                <span style={{ color: o.winRate >= 50 ? GREEN : RED, fontWeight: 600 }}>{o.winRate}%</span>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: TEXT_SECONDARY }}>{o.wins}-{o.losses}-{o.draws}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: TEXT_DIM, fontSize: '12px' }}>{o.lastPlayed ? formatDate(o.lastPlayed) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── NEW: Trends Tab ──
// ════════════════════════════════════════════════════════════════
function TrendsTab({ data }: { data: TeamData }) {
  const { trends } = data
  const [formCount, setFormCount] = useState(10)

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    {/* Win Rate Over Time Chart */}
    <div style={glowCardStyle}>
      <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Win Rate Over Time</h3>
      <WinRateChart data={trends.weeklyWinRates} />
    </div>

    {/* Streaks */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
      <SummaryCard label="Current Streak" value={trends.streaks.current > 0 ? `${trends.streaks.current} ${trends.streaks.currentType === 'win' ? 'W' : 'L'}` : '—'} sub={trends.streaks.currentType === 'win' ? 'winning' : trends.streaks.currentType === 'loss' ? 'losing' : ''} color={trends.streaks.currentType === 'win' ? GREEN : trends.streaks.currentType === 'loss' ? RED : TEXT_DIM} />
      <SummaryCard label="Longest Win Streak" value={String(trends.streaks.longestWin)} sub="consecutive wins" color={GREEN} />
      <SummaryCard label="Longest Loss Streak" value={String(trends.streaks.longestLoss)} sub="consecutive losses" color={RED} />
    </div>

    {/* Recent Form */}
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, margin: 0 }}>Recent Form</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[5, 10, 20].map(n => (
            <button key={n} onClick={() => setFormCount(n)} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, background: formCount === n ? `${CYAN}22` : 'transparent', color: formCount === n ? CYAN : TEXT_DIM, border: `1px solid ${formCount === n ? CYAN + '44' : BORDER}`, borderRadius: '6px', cursor: 'pointer' }}>Last {n}</button>
          ))}
        </div>
      </div>
      {/* Form dots */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {trends.recentForm.slice(0, formCount).map((f, i) => {
          const c = f.result ? RESULT_COLORS[f.result] : null
          return <span key={i} title={`${f.mapName} vs ${f.opponent}: ${f.score ?? '?'} (${formatDate(f.date)})`} style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: c?.bg ?? `${TEXT_DIM}22`, color: c?.text ?? TEXT_DIM, cursor: 'default' }}>{c?.label ?? '?'}</span>
        })}
      </div>
      {/* Form summary */}
      {(() => {
        const slice = trends.recentForm.slice(0, formCount)
        const w = slice.filter(f => f.result === 'win').length
        const l = slice.filter(f => f.result === 'loss').length
        const d = slice.filter(f => f.result === 'draw').length
        const wr = slice.length > 0 ? Math.round((w / slice.length) * 100) : 0
        return <div style={{ color: TEXT_SECONDARY, fontSize: '12px' }}>Last {slice.length}: {w}W {l}L {d}D — {wr}% win rate</div>
      })()}
    </div>
  </div>
}

// ── Win Rate Over Time Line Chart (SVG) ──
function WinRateChart({ data }: { data: WeeklyWinRate[] }) {
  if (data.length === 0) return <div style={{ color: TEXT_DIM, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No trend data yet</div>

  const w = 700, h = 200, pad = { top: 20, right: 20, bottom: 40, left: 40 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom

  const points = data.map((d, i) => ({
    x: pad.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: pad.top + chartH - (d.winRate / 100) * chartH,
    ...d,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${pad.top + chartH} L ${points[0].x} ${pad.top + chartH} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = pad.top + chartH - (v / 100) * chartH
        return <g key={v}>
          <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke={BORDER} strokeWidth="1" strokeDasharray={v === 50 ? '4,2' : ''} opacity={v === 50 ? 0.6 : 0.3} />
          <text x={pad.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fill={TEXT_DIM} fontSize="10">{v}%</text>
        </g>
      })}
      {/* Area fill */}
      <path d={areaD} fill={`${CYAN}10`} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={CYAN} strokeWidth="2" />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={BG_CARD} stroke={CYAN} strokeWidth="2">
            <title>{p.week}: {p.winRate}% ({p.wins}W-{p.losses}L-{p.draws}D)</title>
          </circle>
        </g>
      ))}
      {/* X axis labels */}
      {points.filter((_, i) => data.length <= 12 || i % Math.ceil(data.length / 8) === 0).map((p, i) => (
        <text key={i} x={p.x} y={h - 8} textAnchor="middle" fill={TEXT_DIM} fontSize="9" transform={`rotate(-25, ${p.x}, ${h - 8})`}>{p.week}</text>
      ))}
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════
// ── NEW: Heroes Tab ──
// ════════════════════════════════════════════════════════════════
function HeroesTab({ data }: { data: TeamData }) {
  const { heroes } = data

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    {/* Overview cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
      <SummaryCard label="Unique Heroes" value={String(heroes.totalUnique)} sub={`of ${heroes.roleBreakdown.Tank + heroes.roleBreakdown.Damage + heroes.roleBreakdown.Support} roles used`} color={CYAN} />
      <SummaryCard label="Diversity Score" value={`${heroes.diversityScore}%`} sub="hero pool coverage" color={heroes.diversityScore >= 40 ? GREEN : AMBER} />
      <SummaryCard label="Tank Heroes" value={String(heroes.roleBreakdown.Tank)} sub="unique tanks used" color={BLUE} />
      <SummaryCard label="DPS Heroes" value={String(heroes.roleBreakdown.Damage)} sub="unique DPS used" color={RED} />
      <SummaryCard label="Support Heroes" value={String(heroes.roleBreakdown.Support)} sub="unique supports used" color={GREEN} />
    </div>

    {/* Hero Pool by Role */}
    {(['Tank', 'Damage', 'Support'] as const).map(role => {
      const roleHeroes = heroes.heroPool.filter(h => h.role === role)
      if (roleHeroes.length === 0) return null
      const maxTime = Math.max(...roleHeroes.map(h => h.totalTime), 1)

      return (
        <div key={role} style={{ ...cardStyle, borderLeft: `3px solid ${ROLE_COLORS[role]}` }}>
          <h3 style={{ color: ROLE_COLORS[role], fontSize: '14px', fontWeight: 700, marginTop: 0, marginBottom: '12px' }}>{role} Heroes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {roleHeroes.map(h => (
              <div key={h.hero} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '100px', color: TEXT_PRIMARY, fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>{h.hero}</div>
                <div style={{ flex: 1, position: 'relative', height: '20px', background: `${BORDER}44`, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(h.totalTime / maxTime) * 100}%`, background: `${ROLE_COLORS[role]}33`, borderRadius: '4px', transition: 'width 0.3s' }} />
                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: TEXT_SECONDARY, fontWeight: 500 }}>{formatTime(h.totalTime)}</span>
                </div>
                <div style={{ width: '50px', textAlign: 'center', color: h.winRate >= 50 ? GREEN : RED, fontSize: '12px', fontWeight: 600 }}>{h.winRate}%</div>
                <div style={{ width: '40px', textAlign: 'center', color: TEXT_DIM, fontSize: '11px' }}>{h.mapsPlayed}m</div>
              </div>
            ))}
          </div>
        </div>
      )
    })}
  </div>
}

// ════════════════════════════════════════════════════════════════
// ── NEW: Teamfights Tab ──
// ════════════════════════════════════════════════════════════════
function TeamfightsTab({ data }: { data: TeamData }) {
  const { teamfights, rolePerformance } = data

  // Ult economy per role
  const ultData = rolePerformance.map(r => ({
    role: r.role,
    earned: r.ultsEarned,
    used: r.ultsUsed,
    efficiency: r.ultsUsed > 0 ? Math.round((r.totalElims / r.ultsUsed) * 100) / 100 : 0,
    wasteRate: r.ultsEarned > 0 ? Math.round(((r.ultsEarned - r.ultsUsed) / r.ultsEarned) * 100) : 0,
  }))

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    {/* Fight Stats KPIs */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
      <SummaryCard label="Total Fights" value={String(teamfights.totalFights)} sub="team fights analyzed" color={CYAN} />
      <SummaryCard label="Fight Win Rate" value={`${teamfights.fightWinRate}%`} sub={`${teamfights.fightsWon} won`} color={teamfights.fightWinRate >= 50 ? GREEN : RED} />
      <SummaryCard label="First Pick Win %" value={`${teamfights.firstPickWinRate}%`} sub={`${teamfights.firstPickTotal} first picks`} color={teamfights.firstPickWinRate >= 50 ? GREEN : AMBER} />
      <SummaryCard label="First Death Win %" value={`${teamfights.firstDeathWinRate}%`} sub={`${teamfights.firstDeathTotal} first deaths`} color={teamfights.firstDeathWinRate >= 50 ? GREEN : RED} />
      <SummaryCard label="Avg Fight Duration" value={`${teamfights.avgFightDuration}s`} sub="seconds per fight" color={PURPLE} />
    </div>

    {/* Win Probability Insights */}
    <div style={glowCardStyle}>
      <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Win Probability Insights</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <InsightBar label="When we get first pick" value={teamfights.firstPickWinRate} total={teamfights.firstPickTotal} color={GREEN} />
        <InsightBar label="When we suffer first death" value={teamfights.firstDeathWinRate} total={teamfights.firstDeathTotal} color={RED} />
        <InsightBar label="Overall fight win rate" value={teamfights.fightWinRate} total={teamfights.totalFights} color={CYAN} />
      </div>
    </div>

    {/* Ultimate Economy */}
    <div style={cardStyle}>
      <h3 style={{ color: TEXT_PRIMARY, fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Ultimate Economy</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
        {ultData.map(u => (
          <div key={u.role} style={{ padding: '14px', background: BG_BASE, borderRadius: '8px', borderLeft: `3px solid ${ROLE_COLORS[u.role] ?? CYAN}` }}>
            <div style={{ color: ROLE_COLORS[u.role] ?? CYAN, fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{u.role}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <MiniStat label="Earned" value={String(u.earned)} color={CYAN} />
              <MiniStat label="Used" value={String(u.used)} color={AMBER} />
              <MiniStat label="Kills/Ult" value={String(u.efficiency)} color={u.efficiency >= 2 ? GREEN : AMBER} />
              <MiniStat label="Unused %" value={`${u.wasteRate}%`} color={u.wasteRate <= 15 ? GREEN : RED} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
}

// ── Insight Bar Component ──
function InsightBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: TEXT_SECONDARY, fontSize: '12px' }}>{label}</span>
        <span style={{ color, fontSize: '13px', fontWeight: 700 }}>{value}% <span style={{ color: TEXT_DIM, fontWeight: 400, fontSize: '11px' }}>({total})</span></span>
      </div>
      <div style={{ height: '8px', background: `${BORDER}66`, borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── Sub-components ──
// ════════════════════════════════════════════════════════════════

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ color: TEXT_DIM, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color, fontSize: '24px', fontWeight: 700, lineHeight: 1.1 }}>{value}</span>
      <span style={{ color: TEXT_DIM, fontSize: '11px' }}>{sub}</span>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ color: TEXT_DIM, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ color, fontSize: '14px', fontWeight: 700 }}>{value}</div>
    </div>
  )
}
