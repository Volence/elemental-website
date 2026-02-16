'use client'

import React, { useState, useEffect } from 'react'

type PlayerRow = {
  name: string
  team: string
  hero: string
  eliminations: number
  assists: number
  deaths: number
  damage: number
  healing: number
  finalBlows: number
  timePlayed: number
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
  teams: { team1: string; team2: string }
  summary: {
    matchTime: number
    score: string
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
  }
  calculatedStats: CalculatedStat[]
}

type SortKey = keyof PlayerRow
type SortDir = 'asc' | 'desc'

// ── Design tokens ──
const CYAN = '#06b6d4'
const CYAN_DIM = 'rgba(6, 182, 212, 0.12)'
const GREEN = '#22c55e'
const GREEN_DIM = 'rgba(34, 197, 94, 0.08)'
const RED = '#ef4444'
const RED_DIM = 'rgba(239, 68, 68, 0.08)'
const PURPLE = '#8b5cf6'
const PURPLE_DIM = 'rgba(139, 92, 246, 0.08)'
const AMBER = '#f59e0b'
const BG_CARD = '#1a1a2e'
const BG_CARD_HOVER = '#1e1e36'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const BORDER_ACCENT = 'rgba(6, 182, 212, 0.2)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
  padding: '20px',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: TEXT_SECONDARY,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  fontWeight: 600,
  marginBottom: '8px',
}

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
export default function ScrimMapDetailView() {
  const [data, setData] = useState<MapStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('team')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mapId = params.get('mapId')
    if (!mapId) {
      setError('No mapId provided')
      setLoading(false)
      return
    }

    fetch(`/api/scrim-stats?mapId=${mapId}`)
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
      <div style={{ padding: '60px', textAlign: 'center', color: TEXT_SECONDARY }}>
        <div style={{ fontSize: '14px' }}>Loading map analytics…</div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ color: RED, marginBottom: '12px' }}>❌ {error || 'Unknown error'}</p>
        <a href="/admin/scrims" style={{ color: TEXT_SECONDARY, fontSize: '13px' }}>
          ← Back to scrims
        </a>
      </div>
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

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <a href="/admin/scrims" style={{ color: TEXT_SECONDARY, fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'color 0.15s' }}>
          ← Back to scrims
        </a>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '12px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: TEXT_PRIMARY, letterSpacing: '-0.5px' }}>
            {data.mapName}
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
            {data.mapType}
          </span>
        </div>
        <p style={{ color: TEXT_SECONDARY, fontSize: '14px', marginTop: '6px' }}>
          <span style={{ color: team1Won ? GREEN : team2Won ? TEXT_SECONDARY : TEXT_PRIMARY, fontWeight: team1Won ? 600 : 400 }}>{data.teams.team1}</span>
          {' '}vs{' '}
          <span style={{ color: team2Won ? GREEN : team1Won ? TEXT_SECONDARY : TEXT_PRIMARY, fontWeight: team2Won ? 600 : 400 }}>{data.teams.team2}</span>
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: data.summary.distance ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <SummaryCard label="Match Time" value={toTimestamp(data.summary.matchTime)} sub={`${(data.summary.matchTime / 60).toFixed(1)} minutes`} />
        <SummaryCard
          label="Score"
          value={data.summary.score}
          sub={team1Won ? `${data.teams.team1} wins` : team2Won ? `${data.teams.team2} wins` : 'Draw'}
          accentColor={CYAN}
        />
        {data.summary.distance && (
          <SummaryCard
            label="Distance Pushed"
            value={`${data.summary.distance.round1.meters}m - ${data.summary.distance.round2.meters !== null ? `${data.summary.distance.round2.meters}m` : '?'}`}
            sub={`${data.summary.distance.round1.team} · ${data.summary.distance.round2.team}`}
            accentColor={AMBER}
          />
        )}
        <SummaryCard
          label="Hero Damage"
          value={`${formatNumber(data.summary.team1Damage)} - ${formatNumber(data.summary.team2Damage)}`}
          sub={`${data.summary.team1Damage > data.summary.team2Damage ? data.teams.team1 : data.teams.team2} dealt more`}
          accentColor={RED}
        />
        <SummaryCard
          label="Healing"
          value={`${formatNumber(data.summary.team1Healing)} - ${formatNumber(data.summary.team2Healing)}`}
          sub={`${data.summary.team1Healing > data.summary.team2Healing ? data.teams.team1 : data.teams.team2} healed more`}
          accentColor={GREEN}
        />
      </div>

      {/* Stat Table */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '16px 20px 10px', fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}` }}>
          Player Stats
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {(['name', 'hero', 'eliminations', 'assists', 'deaths', 'finalBlows', 'damage', 'healing'] as SortKey[]).map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    style={{
                      padding: '10px 14px',
                      textAlign: col === 'name' || col === 'hero' ? 'left' : 'right',
                      cursor: 'pointer',
                      fontWeight: sortKey === col ? 700 : 500,
                      color: sortKey === col ? CYAN : TEXT_SECONDARY,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      transition: 'color 0.15s',
                    }}
                  >
                    {col === 'finalBlows' ? 'FB' : col.charAt(0).toUpperCase() + col.slice(1)}
                    {sortKey === col && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Team 1 */}
              <TeamHeader name={data.teams.team1} color={GREEN} bgColor={GREEN_DIM} won={team1Won} />
              {team1Players.map((p) => (
                <StatRow key={p.name + p.hero} player={p} onClick={() => setSelectedPlayer(p.name)} selected={selectedPlayer === p.name} />
              ))}
              <TeamTotalRow players={team1Players} color={GREEN} />
              {/* Team 2 */}
              <TeamHeader name={data.teams.team2} color={RED} bgColor={RED_DIM} won={team2Won} />
              {team2Players.map((p) => (
                <StatRow key={p.name + p.hero} player={p} onClick={() => setSelectedPlayer(p.name)} selected={selectedPlayer === p.name} />
              ))}
              <TeamTotalRow players={team2Players} color={RED} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Fight Analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Total Fights</div>
          <div style={{ ...VALUE_STYLE, fontSize: '32px', color: CYAN }}>{data.analysis.totalFights}</div>
          <div style={SUB_STYLE}>teamfights identified</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>First Deaths</div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: data.analysis.team1FirstDeathPct > 50 ? RED : GREEN }}>
                {data.analysis.team1FirstDeathPct}%
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px' }}>
                {data.teams.team1} ({data.analysis.team1FirstDeaths})
              </div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: data.analysis.team2FirstDeathPct > 50 ? RED : GREEN }}>
                {data.analysis.team2FirstDeathPct}%
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px' }}>
                {data.teams.team2} ({data.analysis.team2FirstDeaths})
              </div>
            </div>
          </div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Ultimate Kills</div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: PURPLE }}>
                {data.analysis.team1UltKills}
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px' }}>
                {data.teams.team1}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: PURPLE }}>
                {data.analysis.team2UltKills}
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px' }}>
                {data.teams.team2}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Detail Card */}
      {selectedCalcStat && (
        <div style={{ ...CARD_STYLE, marginBottom: '28px', borderColor: BORDER_ACCENT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '20px', color: TEXT_PRIMARY }}>{selectedCalcStat.playerName}</div>
              <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginTop: '2px' }}>
                {selectedCalcStat.hero} · {selectedCalcStat.role}
              </div>
            </div>
            <button
              onClick={() => setSelectedPlayer(null)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: '6px',
                color: TEXT_SECONDARY,
                cursor: 'pointer',
                fontSize: '14px',
                padding: '6px 10px',
                transition: 'all 0.15s',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <StatMini label="First Pick %" value={`${selectedCalcStat.firstPickPercentage}%`} sub={`${selectedCalcStat.firstPickCount} picks`} color={GREEN} />
            <StatMini label="First Death %" value={`${selectedCalcStat.firstDeathPercentage}%`} sub={`${selectedCalcStat.firstDeathCount} deaths`} color={RED} />
            <StatMini label="Fleta Deadlift" value={`${selectedCalcStat.fletaDeadliftPercentage}%`} color={CYAN} />
            <StatMini label="Fight Reversal" value={`${selectedCalcStat.fightReversalPercentage}%`} color={PURPLE} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <StatMini label="Avg Ult Charge" value={`${selectedCalcStat.averageUltChargeTime}s`} />
            <StatMini label="Avg Ult Hold" value={`${selectedCalcStat.averageTimeToUseUlt}s`} />
            <StatMini label="Kills per Ult" value={`${selectedCalcStat.killsPerUltimate}`} />
            <StatMini label="Drought Time" value={`${selectedCalcStat.droughtTime}s`} sub="avg between kills" />
          </div>

          {selectedCalcStat.ajaxCount > 0 && (
            <div style={{ fontSize: '13px', padding: '10px 14px', background: RED_DIM, borderRadius: '8px', marginBottom: '16px', border: `1px solid rgba(239, 68, 68, 0.15)` }}>
              🎺 <strong>{selectedCalcStat.ajaxCount}</strong> Ajax{selectedCalcStat.ajaxCount !== 1 ? 'es' : ''} (died during Lúcio ult)
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
        <div style={CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY }}>
              Advanced Stats
              <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM, marginLeft: '10px' }}>
                Click a player row above for full detail
              </span>
            </div>
            <ColumnKeyToggle />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Player', 'Hero', 'FP%', 'FD%', 'Fleta%', 'Ult Charge', 'Ult Hold', 'K/Ult', 'Drought'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 12px',
                      textAlign: h === 'Player' || h === 'Hero' ? 'left' : 'right',
                      fontWeight: 600,
                      color: TEXT_SECONDARY,
                      textTransform: 'uppercase',
                      fontSize: '10px',
                      letterSpacing: '0.5px',
                    }}>
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
                    style={{ cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, transition: 'background 0.15s' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: TEXT_PRIMARY }}>{s.playerName}</td>
                    <td style={{ padding: '10px 12px', color: TEXT_SECONDARY }}>{s.hero}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: s.firstPickPercentage > 20 ? GREEN : TEXT_PRIMARY }}>{s.firstPickPercentage}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: s.firstDeathPercentage > 20 ? RED : TEXT_PRIMARY }}>{s.firstDeathPercentage}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s.fletaDeadliftPercentage}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s.averageUltChargeTime}s</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s.averageTimeToUseUlt}s</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s.killsPerUltimate}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s.droughtTime}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function SummaryCard({ label, value, sub, accentColor }: { label: string; value: string; sub: string; accentColor?: string }) {
  return (
    <div style={{
      ...CARD_STYLE,
      borderTop: accentColor ? `2px solid ${accentColor}` : `2px solid ${BORDER}`,
      position: 'relative',
    }}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={{ ...VALUE_STYLE, color: accentColor ?? TEXT_PRIMARY }}>{value}</div>
      <div style={SUB_STYLE}>{sub}</div>
    </div>
  )
}

function TeamHeader({ name, color, bgColor, won }: { name: string; color: string; bgColor: string; won: boolean }) {
  return (
    <tr>
      <td colSpan={8} style={{
        padding: '12px 14px 6px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color,
        background: bgColor,
        borderLeft: `3px solid ${color}`,
      }}>
        {name} {won && <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '6px' }}>WIN</span>}
      </td>
    </tr>
  )
}

function TeamTotalRow({ players, color }: { players: PlayerRow[]; color: string }) {
  const borderColor = color === GREEN ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'
  const bgColor = color === GREEN ? 'rgba(34, 197, 94, 0.04)' : 'rgba(239, 68, 68, 0.04)'
  const cellStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'right',
    fontWeight: 700,
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    color,
  }
  return (
    <tr style={{ borderBottom: `2px solid ${borderColor}`, background: bgColor }}>
      <td style={{ ...cellStyle, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }} colSpan={2}>
        Team Total
      </td>
      <td style={cellStyle}>{sumStat(players, 'eliminations')}</td>
      <td style={cellStyle}>{sumStat(players, 'assists')}</td>
      <td style={cellStyle}>{sumStat(players, 'deaths')}</td>
      <td style={cellStyle}>{sumStat(players, 'finalBlows')}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'damage'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'healing'))}</td>
    </tr>
  )
}

/** Single stat table row */
function StatRow({ player, onClick, selected }: { player: PlayerRow; onClick: () => void; selected: boolean }) {
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? PURPLE_DIM : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <td style={{ padding: '10px 14px', fontWeight: 600, color: TEXT_PRIMARY }}>{player.name}</td>
      <td style={{ padding: '10px 14px', color: TEXT_SECONDARY }}>{player.hero}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.eliminations}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.assists}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.deaths}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.finalBlows}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(player.damage)}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(player.healing)}</td>
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
        style={{
          background: open ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${BORDER}`,
          borderRadius: '6px',
          padding: '5px 12px',
          fontSize: '11px',
          color: TEXT_SECONDARY,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s',
          fontWeight: 500,
        }}
        title="Show column definitions"
      >
        ℹ️ Key
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
