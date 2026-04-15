'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, AlertCircle, ArrowLeft, Pencil, X, Info, ChevronDown, Trophy, Ruler, Flame, Heart, Music, Clock } from 'lucide-react'
import KillfeedTab from './KillfeedTab'
import ChartsTab from './ChartsTab'
import EventsTab from './EventsTab'
import CompareTab from './CompareTab'
import ReplayTab from './ReplayTab'
import ScrimAnalyticsTabs from '@/components/ScrimAnalyticsTabs'

type PlayerRow = {
  name: string
  team: string
  hero: string
  role: string
  eliminations: number
  assists: number
  deaths: number
  damage: number
  healing: number
  finalBlows: number
  timePlayed: number
  kd: number
  kad: number
  damageReceived: number
  healingReceived: number
}

type CalculatedStat = {
  playerName: string
  hero: string
  role: string
  fletaDeadliftPercentage: number
  firstPickPercentage: number
  firstPickCount: number
  firstDeathPercentage: number
  firstDeathCount: number
  ajaxCount: number
  averageUltChargeTime: number
  averageTimeToUseUlt: number
  droughtTime: number
  killsPerUltimate: number
  fightReversalPercentage: number
  duels: Array<{
    heroName: string
    wins: number
    losses: number
    winRate: number
  }>
}

type MapStats = {
  mapName: string
  mapType: string
  teams: { team1: string; team2: string; payloadTeamId?: number | null; payloadTeamId2?: number | null; isDualTeam?: boolean }
  summary: {
    matchTime: number
    score: string
    scoreOverride: string | null
    canEditScore: boolean
    team1Damage: number
    team2Damage: number
    team1Healing: number
    team2Healing: number
    distance?: {
      round1: { team: string; meters: number }
      round2: { team: string; meters: number | null }
    }
  }
  players: PlayerRow[]
  analysis: {
    totalFights: number
    team1FirstDeaths: number
    team2FirstDeaths: number
    team1FirstDeathPct: number
    team2FirstDeathPct: number
    team1UltKills: number
    team2UltKills: number
    ajaxes: Array<{ time: number; team: string; player: string }>
  }
  calculatedStats: CalculatedStat[]
}

type SortKey = keyof PlayerRow
type SortDir = 'asc' | 'desc'

const COLUMN_DEFS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'hero', label: 'Hero', align: 'left' },
  { key: 'role', label: 'Role', align: 'left' },
  { key: 'timePlayed', label: 'Time Played', align: 'right' },
  { key: 'eliminations', label: 'Eliminations', align: 'right' },
  { key: 'finalBlows', label: 'Final Blows', align: 'right' },
  { key: 'assists', label: 'Assists', align: 'right' },
  { key: 'deaths', label: 'Deaths', align: 'right' },
  { key: 'kd', label: 'K/D', align: 'right' },
  { key: 'kad', label: 'KA/D', align: 'right' },
  { key: 'damage', label: 'Hero Damage Dealt', align: 'right' },
  { key: 'damageReceived', label: 'Damage Received', align: 'right' },
  { key: 'healingReceived', label: 'Healing Received', align: 'right' },
  { key: 'healing', label: 'Healing Dealt', align: 'right' },
]

// ── Dynamic color tokens (kept for runtime-computed styles) ──
const CYAN = '#06b6d4'
const CYAN_DIM = 'rgba(6, 182, 212, 0.12)'
const GREEN = '#22c55e'
const GREEN_DIM = 'rgba(34, 197, 94, 0.08)'
const RED = '#ef4444'
const RED_DIM = 'rgba(239, 68, 68, 0.08)'
const PURPLE = '#8b5cf6'
const PURPLE_DIM = 'rgba(139, 92, 246, 0.08)'
const AMBER = '#f59e0b'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const BORDER_ACCENT = 'rgba(6, 182, 212, 0.2)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'



const VALUE_STYLE: React.CSSProperties = {
  fontSize: '26px',
  fontWeight: 700,
  color: TEXT_PRIMARY,
  letterSpacing: '-0.5px',
  lineHeight: 1.2,
}

const SUB_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: TEXT_DIM,
  marginTop: '6px',
}

const BG = '#0a0e1a'

function toTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function sumStat(players: PlayerRow[], key: keyof PlayerRow): number {
  return players.reduce((acc, p) => acc + (p[key] as number), 0)
}

/**
 * Admin view — map-level scrim analytics dashboard.
 * Accessible at /admin/scrim-map?mapId=N.
 */
type TabId = 'overview' | 'killfeed' | 'charts' | 'events' | 'compare' | 'replay'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'killfeed', label: 'Killfeed' },
  { id: 'charts', label: 'Charts' },
  { id: 'events', label: 'Events' },
  { id: 'compare', label: 'Compare' },
  { id: 'replay', label: 'Replay' },
]

export default function ScrimMapDetailView() {
  const [data, setData] = useState<MapStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('team')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [mapId, setMapId] = useState<string>('')
  const [editingScore, setEditingScore] = useState(false)
  const [scoreInput1, setScoreInput1] = useState('')
  const [scoreInput2, setScoreInput2] = useState('')
  const [scoreSaving, setScoreSaving] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('mapId')
    if (!id) {
      setError('No mapId provided')
      setLoading(false)
      return
    }
    setMapId(id)

    fetch(`/api/scrim-stats?mapId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error)
        } else {
          setData(d)
        }
      })
      .catch(() => setError('Failed to fetch stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
      <ScrimAnalyticsTabs activeTab="scrims" />
      <div className="scrim-players__loading">
        <div className="scrim-players__loading-icon"><Loader2 size={32} /></div>
        <div className="scrim-players__loading-text">Loading map analytics…</div>
      </div>
      </>
    )
  }
  if (error || !data) {
    return (
      <>
      <ScrimAnalyticsTabs activeTab="scrims" />
      <div className="scrim-players__error">
        <p><AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />{error || 'Unknown error'}</p>
        <a href="/admin/scrims" className="scrim-detail__back-link">
          <ArrowLeft size={12} /> Back to scrims
        </a>
      </div>
      </>
    )
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'team' || key === 'hero' ? 'asc' : 'desc')
    }
  }

  const sortedPlayers = [...data.players].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const team1Players = sortedPlayers.filter((p) => p.team === data.teams.team1)
  const team2Players = sortedPlayers.filter((p) => p.team === data.teams.team2)

  const selectedCalcStat = selectedPlayer
    ? data.calculatedStats.find((s) => s.playerName === selectedPlayer)
    : null

  // Parse score for win/loss coloring
  const [s1, s2] = data.summary.score.split(' - ').map(Number)
  const team1Won = s1 > s2
  const team2Won = s2 > s1

  // Dynamic team colors: neutral Cyan/Amber for dual-team (internal) scrims
  const isDual = data.teams.isDualTeam ?? false
  const TEAM1_COLOR = isDual ? CYAN : GREEN
  const TEAM1_DIM = isDual ? CYAN_DIM : GREEN_DIM
  const TEAM2_COLOR = isDual ? AMBER : RED
  const TEAM2_DIM = isDual ? 'rgba(245, 158, 11, 0.08)' : RED_DIM

  return (
    <>
    <ScrimAnalyticsTabs activeTab="scrims" />
    <div className="scrim-detail__content" style={{ background: BG, minHeight: '100%' }}>
      {/* Header */}
      <div className="scrim-detail__header">
        <a href="/admin/scrims" className="scrim-detail__back-link">
          <ArrowLeft size={12} /> Back to scrims
        </a>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '12px' }}>
          <h1 className="scrim-detail__player-name">
            {data.mapName}
          </h1>
          <span className="scrim-upload__map-type-badge">
            {data.mapType}
          </span>
        </div>
        <p className="scrim-detail__player-meta">
          {data.teams.payloadTeamId ? (
            <a
              href={`/admin/scrim-team?teamId=${data.teams.payloadTeamId}`}
              style={{
                color: team1Won ? GREEN : team2Won ? TEXT_SECONDARY : TEXT_PRIMARY,
                fontWeight: team1Won ? 600 : 400,
                textDecoration: 'none',
                borderBottom: `1px solid ${CYAN}44`,
              }}
            >
              {data.teams.team1}
            </a>
          ) : (
            <span style={{ color: team1Won ? GREEN : team2Won ? TEXT_SECONDARY : TEXT_PRIMARY, fontWeight: team1Won ? 600 : 400 }}>{data.teams.team1}</span>
          )}
          {' '}vs{' '}
          {data.teams.payloadTeamId2 ? (
            <a
              href={`/admin/scrim-team?teamId=${data.teams.payloadTeamId2}`}
              style={{
                color: team2Won ? GREEN : team1Won ? TEXT_SECONDARY : TEXT_PRIMARY,
                fontWeight: team2Won ? 600 : 400,
                textDecoration: 'none',
                borderBottom: `1px solid ${CYAN}44`,
              }}
            >
              {data.teams.team2}
            </a>
          ) : (
            <span style={{ color: team2Won ? GREEN : team1Won ? TEXT_SECONDARY : TEXT_PRIMARY, fontWeight: team2Won ? 600 : 400 }}>{data.teams.team2}</span>
          )}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="scrim-detail__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`scrim-detail__tab ${activeTab === tab.id ? 'scrim-detail__tab--active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Killfeed */}
      {activeTab === 'killfeed' && mapId && <KillfeedTab mapId={mapId} />}

      {/* Tab: Charts */}
      {activeTab === 'charts' && mapId && <ChartsTab mapId={mapId} />}

      {/* Tab: Events */}
      {activeTab === 'events' && mapId && <EventsTab mapId={mapId} />}

      {/* Tab: Compare */}
      {activeTab === 'compare' && mapId && <CompareTab mapId={mapId} />}

      {/* Tab: Replay */}
      {activeTab === 'replay' && mapId && <ReplayTab mapId={mapId} />}

      {/* Tab: Overview (existing content) */}
      {activeTab === 'overview' && <>
      {/* Summary Cards */}
      <div className="scrim-detail__stat-grid" style={{ gridTemplateColumns: data.summary.distance ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)' }}>
        <SummaryCard label="Total Match Time" value={toTimestamp(data.summary.matchTime)} sub={`${(data.summary.matchTime / 60).toFixed(1)} minutes`} icon={<Clock size={16} />} />

        {/* Score card with inline editing */}
        <div className="scrim-detail__summary-card" style={{ borderTop: `2px solid ${CYAN}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}><Trophy size={14} /></span>
              <span className="scrim-detail__label">
                Score
              </span>
            </div>
            {data.summary.canEditScore && !editingScore && (
              <button
                onClick={() => {
                  const [s1, s2] = data.summary.score.split(' - ').map(Number)
                  setScoreInput1(String(s1 ?? 0))
                  setScoreInput2(String(s2 ?? 0))
                  setEditingScore(true)
                }}
                title="Edit score"
                className="scrim-list__action-btn"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
          {editingScore ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min="0"
                  value={scoreInput1}
                  onChange={e => setScoreInput1(e.target.value)}
                  style={{
                    width: '50px', padding: '6px 8px', borderRadius: '6px',
                    border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)',
                    color: TEXT_PRIMARY, fontSize: '20px', fontWeight: 700,
                    textAlign: 'center', fontFamily: 'inherit',
                  }}
                />
                <span style={{ fontSize: '20px', fontWeight: 700, color: TEXT_DIM }}>–</span>
                <input
                  type="number"
                  min="0"
                  value={scoreInput2}
                  onChange={e => setScoreInput2(e.target.value)}
                  style={{
                    width: '50px', padding: '6px 8px', borderRadius: '6px',
                    border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)',
                    color: TEXT_PRIMARY, fontSize: '20px', fontWeight: 700,
                    textAlign: 'center', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={scoreSaving}
                  onClick={async () => {
                    setScoreSaving(true)
                    try {
                      const score = `${parseInt(scoreInput1) || 0} - ${parseInt(scoreInput2) || 0}`
                      await fetch('/api/scrim-score-override', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mapDataId: parseInt(mapId), score }),
                      })
                      // Refresh data
                      const r = await fetch(`/api/scrim-stats?mapId=${mapId}`)
                      const d = await r.json()
                      if (!d.error) setData(d)
                      setEditingScore(false)
                    } finally { setScoreSaving(false) }
                  }}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', border: 'none',
                    background: CYAN, color: '#000', fontSize: '11px', fontWeight: 700,
                    cursor: scoreSaving ? 'not-allowed' : 'pointer', opacity: scoreSaving ? 0.5 : 1,
                  }}
                >
                  {scoreSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingScore(false)}
                  style={{
                    padding: '4px 12px', borderRadius: '6px',
                    border: `1px solid ${BORDER}`, background: 'transparent',
                    color: TEXT_SECONDARY, fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                {data.summary.scoreOverride && (
                  <button
                    disabled={scoreSaving}
                    onClick={async () => {
                      setScoreSaving(true)
                      try {
                        await fetch('/api/scrim-score-override', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ mapDataId: parseInt(mapId), score: null }),
                        })
                        const r = await fetch(`/api/scrim-stats?mapId=${mapId}`)
                        const d = await r.json()
                        if (!d.error) setData(d)
                        setEditingScore(false)
                      } finally { setScoreSaving(false) }
                    }}
                    style={{
                      padding: '4px 12px', borderRadius: '6px',
                      border: `1px solid ${RED}33`, background: 'transparent',
                      color: RED, fontSize: '11px', fontWeight: 600,
                      cursor: scoreSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Clear Override
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div style={VALUE_STYLE}>{data.summary.score}</div>
              <div style={SUB_STYLE}>
                {team1Won ? `Winner: ${data.teams.team1}` : team2Won ? `Winner: ${data.teams.team2}` : 'Draw'}
                {data.summary.scoreOverride && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: AMBER, fontWeight: 600 }}>✓ manual</span>
                )}
              </div>
            </>
          )}
        </div>

        {data.summary.distance && (
          <SummaryCard
            label="Distance Pushed"
            value={`${data.summary.distance.round1.meters}m - ${data.summary.distance.round2.meters !== null ? `${data.summary.distance.round2.meters}m` : '?'}`}
            sub={`${data.summary.distance.round1.team} · ${data.summary.distance.round2.team}`}
            accentColor={AMBER}
            icon={<Ruler size={16} />}
          />
        )}
        <SummaryCard
          label="Hero Damage Dealt"
          value={`${formatNumber(data.summary.team1Damage)} - ${formatNumber(data.summary.team2Damage)}`}
          sub={`${data.summary.team1Damage > data.summary.team2Damage ? data.teams.team1 : data.teams.team2} dealt more hero damage this map.`}
          accentColor={RED}
          icon={<Flame size={16} />}
        />
        <SummaryCard
          label="Team Healing Dealt"
          value={`${formatNumber(data.summary.team1Healing)} - ${formatNumber(data.summary.team2Healing)}`}
          sub={`${data.summary.team1Healing > data.summary.team2Healing ? data.teams.team1 : data.teams.team2} healed more this map.`}
          accentColor={GREEN}
          icon={<Heart size={16} />}
        />
      </div>

      {/* Stat Table */}
      <div className="scrim-detail__map-table-card" style={{ marginBottom: '28px' }}>
        <div className="scrim-detail__map-table-header">
          Player Stats
        </div>
        <div className="scrim-detail__map-table-scroll">
          <table className="scrim-detail__map-table" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                {COLUMN_DEFS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`scrim-detail__map-th ${sortKey === col.key ? 'scrim-detail__map-th--sorted' : ''} ${col.align === 'right' ? 'scrim-detail__map-th--right' : ''}`}
                  >
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Team 1 */}
              <TeamHeader name={data.teams.team1} color={TEAM1_COLOR} bgColor={TEAM1_DIM} won={team1Won} />
              {team1Players.map((p) => (
                <StatRow key={p.name + p.hero} player={p} onClick={() => setSelectedPlayer(p.name)} selected={selectedPlayer === p.name} />
              ))}
              <TeamTotalRow players={team1Players} color={TEAM1_COLOR} />
              {/* Team 2 */}
              <TeamHeader name={data.teams.team2} color={TEAM2_COLOR} bgColor={TEAM2_DIM} won={team2Won} />
              {team2Players.map((p) => (
                <StatRow key={p.name + p.hero} player={p} onClick={() => setSelectedPlayer(p.name)} selected={selectedPlayer === p.name} />
              ))}
              <TeamTotalRow players={team2Players} color={TEAM2_COLOR} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Fight Analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <div className="scrim-detail__summary-card" style={{ borderTop: `2px solid ${CYAN}` }}>
          <div className="scrim-detail__label">Total Fights</div>
          <div style={{ ...VALUE_STYLE, fontSize: '32px', color: CYAN, textShadow: `0 0 20px ${CYAN}44` }}>{data.analysis.totalFights}</div>
          <div style={SUB_STYLE}>teamfights identified</div>
        </div>
        <div className="scrim-detail__summary-card" style={{ borderTop: `2px solid ${RED}` }}>
          <div className="scrim-detail__label">First Deaths</div>
          <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: data.analysis.team1FirstDeathPct > 50 ? RED : GREEN, textShadow: `0 0 12px ${data.analysis.team1FirstDeathPct > 50 ? RED : GREEN}44` }}>
                {data.analysis.team1FirstDeathPct}%
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '4px' }}>
                {data.teams.team1} ({data.analysis.team1FirstDeaths})
              </div>
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: data.analysis.team2FirstDeathPct > 50 ? RED : GREEN, textShadow: `0 0 12px ${data.analysis.team2FirstDeathPct > 50 ? RED : GREEN}44` }}>
                {data.analysis.team2FirstDeathPct}%
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '4px' }}>
                {data.teams.team2} ({data.analysis.team2FirstDeaths})
              </div>
            </div>
          </div>
        </div>
        <div className="scrim-detail__summary-card" style={{ borderTop: `2px solid ${PURPLE}` }}>
          <div className="scrim-detail__label">Ultimate Kills</div>
          <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: PURPLE, textShadow: `0 0 12px ${PURPLE}44` }}>
                {data.analysis.team1UltKills}
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '4px' }}>
                {data.teams.team1}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: PURPLE, textShadow: `0 0 12px ${PURPLE}44` }}>
                {data.analysis.team2UltKills}
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '4px' }}>
                {data.teams.team2}
              </div>
            </div>
          </div>
        </div>

        {/* Ajax card — only shown if any Ajaxes detected */}
        {data.analysis.ajaxes.length > 0 && (
          <div className="scrim-detail__card" style={{ borderTop: `2px solid ${AMBER}`, gridColumn: '1 / -1' }}>
            <div className="scrim-detail__label"><Music size={14} className="scrim-detail__inline-icon" /> Ajaxes (Sound Barrier Cancelled)</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
              {data.analysis.ajaxes.map((ajax, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: `${AMBER}0a`, border: `1px solid ${AMBER}20` }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: AMBER, textShadow: `0 0 8px ${AMBER}44` }}>{ajax.player}</span>
                  <span style={{ fontSize: '11px', color: TEXT_DIM }}>at {toTimestamp(ajax.time)}</span>
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: ajax.team === data.teams.team1 ? TEAM1_DIM : TEAM2_DIM, color: ajax.team === data.teams.team1 ? TEAM1_COLOR : TEAM2_COLOR, fontWeight: 600 }}>{ajax.team}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Player Detail Card */}
      {selectedCalcStat && (
        <div className="scrim-detail__card" style={{ marginBottom: '28px', borderColor: BORDER_ACCENT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '20px', color: TEXT_PRIMARY }}>{selectedCalcStat.playerName}</div>
              <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginTop: '2px' }}>
                {selectedCalcStat.hero} · {selectedCalcStat.role}
              </div>
            </div>
            <button
              onClick={() => setSelectedPlayer(null)}
              className="scrim-list__action-btn"
            >
              <X size={14} />
            </button>
          </div>

          <div className="scrim-detail__stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatMini label="First Pick %" value={`${selectedCalcStat.firstPickPercentage}%`} sub={`${selectedCalcStat.firstPickCount} picks`} color={GREEN} />
            <StatMini label="First Death %" value={`${selectedCalcStat.firstDeathPercentage}%`} sub={`${selectedCalcStat.firstDeathCount} deaths`} color={RED} />
            <StatMini label="Fleta Deadlift" value={`${selectedCalcStat.fletaDeadliftPercentage}%`} color={CYAN} />
            <StatMini label="Fight Reversal" value={`${selectedCalcStat.fightReversalPercentage}%`} color={PURPLE} />
          </div>

          <div className="scrim-detail__stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatMini label="Avg Ult Charge" value={`${selectedCalcStat.averageUltChargeTime}s`} />
            <StatMini label="Avg Ult Hold" value={`${selectedCalcStat.averageTimeToUseUlt}s`} />
            <StatMini label="Kills per Ult" value={`${selectedCalcStat.killsPerUltimate}`} />
            <StatMini label="Drought Time" value={`${selectedCalcStat.droughtTime}s`} sub="avg between kills" />
          </div>

          {selectedCalcStat.ajaxCount > 0 && (
            <div style={{ fontSize: '13px', padding: '10px 14px', background: RED_DIM, borderRadius: '8px', marginBottom: '16px', border: `1px solid rgba(239, 68, 68, 0.15)` }}>
              <Music size={12} style={{ verticalAlign: 'text-bottom', marginRight: '2px' }} /> <strong>{selectedCalcStat.ajaxCount}</strong> Ajax{selectedCalcStat.ajaxCount !== 1 ? 'es' : ''} (died during Lúcio ult)
            </div>
          )}

          {/* Duel Matchups */}
          {selectedCalcStat.duels.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: TEXT_PRIMARY }}>Duel Matchups</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                {selectedCalcStat.duels.map((d, i) => (
                  <div
                    key={`${d.heroName}-${i}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${BORDER}`,
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>{d.heroName}</span>
                    <span style={{ color: d.winRate >= 50 ? GREEN : RED, fontWeight: 700 }}>
                      {d.wins}W-{d.losses}L ({d.winRate}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All Player Calculated Stats */}
      {!selectedPlayer && data.calculatedStats.length > 0 && (
        <div className="scrim-detail__card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY }}>
              Advanced Stats
              <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM, marginLeft: '10px' }}>
                Click a player row above for full detail
              </span>
            </div>
            <ColumnKeyToggle />
          </div>
          <div className="scrim-detail__map-table-scroll">
            <table className="scrim-detail__map-table">
              <thead>
                <tr>
                  {['Player', 'Hero', 'FP%', 'FD%', 'Fleta%', 'Ult Charge', 'Ult Hold', 'K/Ult', 'Drought'].map((h) => (
                    <th key={h} className={`scrim-detail__map-th ${h !== 'Player' && h !== 'Hero' ? 'scrim-detail__map-th--right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.calculatedStats.map((s) => (
                  <tr
                    key={s.playerName}
                    onClick={() => setSelectedPlayer(s.playerName)}
                    className="scrim-detail__map-row"
                  >
                    <td className="scrim-detail__map-td scrim-detail__map-td--map">{s.playerName}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--secondary">{s.hero}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: s.firstPickPercentage > 20 ? GREEN : TEXT_PRIMARY }}>{s.firstPickPercentage}%</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat" style={{ color: s.firstDeathPercentage > 20 ? RED : TEXT_PRIMARY }}>{s.firstDeathPercentage}%</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{s.fletaDeadliftPercentage}%</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{s.averageUltChargeTime}s</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{s.averageTimeToUseUlt}s</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{s.killsPerUltimate}</td>
                    <td className="scrim-detail__map-td scrim-detail__map-td--stat">{s.droughtTime}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>}
    </div>
    </>
  )
}

// ── Sub-components ──

function SummaryCard({ label, value, sub, accentColor, icon }: { label: string; value: string; sub: string; accentColor?: string; icon?: React.ReactNode }) {
  const ac = accentColor ?? CYAN
  return (
    <div className="scrim-detail__summary-card" style={{ borderTop: `2px solid ${ac}` }}>
      <div className="scrim-detail__summary-glow" style={{ background: `radial-gradient(circle at 80% 0%, ${ac}0a 0%, transparent 70%)` }} />
      <div className="scrim-detail__summary-label">
        {icon && <span className="scrim-detail__summary-icon">{icon}</span>}
        {label}
      </div>
      <div className="scrim-detail__summary-value" style={{ color: ac, textShadow: `0 0 16px ${ac}44` }}>{value}</div>
      <div className="scrim-detail__summary-sub">{sub}</div>
    </div>
  )
}

function TeamHeader({ name, color, bgColor, won }: { name: string; color: string; bgColor: string; won: boolean }) {
  return (
    <tr>
      <td colSpan={COLUMN_DEFS.length} style={{
        padding: '12px 14px 6px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color,
        background: bgColor,
        borderLeft: `3px solid ${color}`,
      }}>
        {name} {won && <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '6px', color: GREEN }}>WIN</span>}
      </td>
    </tr>
  )
}

function TeamTotalRow({ players, color }: { players: PlayerRow[]; color: string }) {
  // Derive dim colors dynamically from the passed-in team color
  const borderColor = `${color}26`
  const bgColor = `${color}0a`
  const cellStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'right',
    fontWeight: 700,
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    color,
  }
  const totalElims = sumStat(players, 'eliminations')
  const totalDeaths = sumStat(players, 'deaths')
  const totalAssists = sumStat(players, 'assists')
  return (
    <tr style={{ borderBottom: `2px solid ${borderColor}`, background: bgColor }}>
      <td style={{ ...cellStyle, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }} colSpan={3}>
        Team Total
      </td>
      <td style={cellStyle}></td>
      <td style={cellStyle}>{totalElims}</td>
      <td style={cellStyle}>{sumStat(players, 'finalBlows')}</td>
      <td style={cellStyle}>{totalAssists}</td>
      <td style={cellStyle}>{totalDeaths}</td>
      <td style={cellStyle}>{totalDeaths > 0 ? Math.round(totalElims / totalDeaths * 100) / 100 : totalElims}</td>
      <td style={cellStyle}>{totalDeaths > 0 ? Math.round((totalElims + totalAssists) / totalDeaths * 100) / 100 : totalElims + totalAssists}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'damage'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'damageReceived'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'healingReceived'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'healing'))}</td>
    </tr>
  )
}

/** Single stat table row */
function StatRow({ player, onClick, selected }: { player: PlayerRow; onClick: () => void; selected: boolean }) {
  const timeStr = `${Math.floor(player.timePlayed / 60)}m ${Math.floor(player.timePlayed % 60).toString().padStart(2, '0')}s`
  const cell: React.CSSProperties = { padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  return (
    <tr
      onClick={() => window.location.href = `/admin/scrim-player-detail?player=${encodeURIComponent(player.name)}`}
      style={{
        cursor: 'pointer',
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? PURPLE_DIM : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <td style={{ padding: '10px 12px', fontWeight: 600, color: CYAN }}>{player.name}</td>
      <td style={{ padding: '10px 12px', color: TEXT_SECONDARY }}>{player.hero}</td>
      <td style={{ padding: '10px 12px', color: TEXT_DIM, fontSize: '12px' }}>{player.role}</td>
      <td style={{ ...cell, color: TEXT_DIM }}>{timeStr}</td>
      <td style={cell}>{player.eliminations}</td>
      <td style={cell}>{player.finalBlows}</td>
      <td style={cell}>{player.assists}</td>
      <td style={cell}>{player.deaths}</td>
      <td style={{ ...cell, color: player.kd >= 2 ? GREEN : player.kd < 1 ? RED : TEXT_PRIMARY, fontWeight: 600 }}>{player.kd}</td>
      <td style={{ ...cell, color: player.kad >= 3 ? GREEN : player.kad < 1.5 ? RED : TEXT_PRIMARY, fontWeight: 600 }}>{player.kad}</td>
      <td style={cell}>{formatNumber(player.damage)}</td>
      <td style={cell}>{formatNumber(player.damageReceived)}</td>
      <td style={cell}>{formatNumber(player.healingReceived)}</td>
      <td style={cell}>{formatNumber(player.healing)}</td>
    </tr>
  )
}

/** Collapsible column key for the Advanced Stats table */
function ColumnKeyToggle() {
  const [open, setOpen] = React.useState(false)
  const entries = [
    ['FP%', 'First Pick — % of fights where this player got the opening kill'],
    ['FD%', 'First Death — % of fights where this player died first'],
    ['Fleta%', 'Fleta Deadlift — player\'s final blows as a % relative to teammates'],
    ['Ult Charge', 'Average seconds to fully charge ultimate'],
    ['Ult Hold', 'Average seconds between charging and using ultimate'],
    ['K/Ult', 'Average kills generated per ultimate used'],
    ['Drought', 'Average seconds between kills'],
  ]
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="scrim-list__action-btn"
        style={{ gap: '4px', display: 'flex', alignItems: 'center', padding: '5px 12px', fontSize: '11px' }}
        title="Show column definitions"
      >
        <Info size={12} /> Key
      </button>
      {open && (
        <div style={{
          marginTop: '4px',
          position: 'absolute',
          right: 0,
          zIndex: 10,
          background: '#1e1e36',
          border: `1px solid ${BORDER_ACCENT}`,
          borderRadius: '10px',
          padding: '14px 18px',
          minWidth: '360px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entries.map(([abbr, desc]) => (
              <div key={abbr} style={{ display: 'flex', gap: '10px', fontSize: '12px', lineHeight: '1.5' }}>
                <span style={{ fontWeight: 700, color: CYAN, minWidth: '75px', flexShrink: 0 }}>{abbr}</span>
                <span style={{ color: TEXT_SECONDARY }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Mini stat card used in the player detail section */
function StatMini({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${BORDER}`,
    }}>
      <div style={{ fontSize: '10px', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: color ?? TEXT_PRIMARY }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}
