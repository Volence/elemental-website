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

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--theme-elevation-50, #222)',
  border: '1px solid var(--theme-elevation-150, #333)',
  borderRadius: '10px',
  padding: '20px',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--theme-text-secondary, #888)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  marginBottom: '6px',
}

const VALUE_STYLE: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
}

const SUB_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--theme-text-secondary, #888)',
  marginTop: '4px',
}

function toTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
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
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--theme-text-secondary, #888)' }}>
        Loading map analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--theme-error-500, #ef4444)' }}>❌ {error || 'Unknown error'}</p>
        <a href="/admin/scrims" style={{ color: 'var(--theme-text-secondary, #888)', fontSize: '13px' }}>
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

  return (
    <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <a href="/admin/scrims" style={{ color: 'var(--theme-text-secondary, #888)', fontSize: '13px', textDecoration: 'none' }}>
          ← Back to scrims
        </a>
        <h1 style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', marginBottom: '4px' }}>
          {data.mapName}
        </h1>
        <p style={{ color: 'var(--theme-text-secondary, #888)', fontSize: '13px' }}>
          {data.teams.team1} vs {data.teams.team2} · {data.mapType}
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: data.summary.distance ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Match Time</div>
          <div style={VALUE_STYLE}>{toTimestamp(data.summary.matchTime)}</div>
          <div style={SUB_STYLE}>{(data.summary.matchTime / 60).toFixed(1)} minutes</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Score</div>
          <div style={VALUE_STYLE}>{data.summary.score}</div>
          <div style={SUB_STYLE}>{data.mapType}</div>
        </div>
        {data.summary.distance && (
          <div style={CARD_STYLE}>
            <div style={LABEL_STYLE}>Distance Pushed</div>
            <div style={VALUE_STYLE} title={`${data.summary.distance.round1.team} vs ${data.summary.distance.round2.team}`}>
              {data.summary.distance.round1.meters}m - {data.summary.distance.round2.meters !== null ? `${data.summary.distance.round2.meters}m` : '?'}
            </div>
            <div style={SUB_STYLE}>
              {data.summary.distance.round1.team} · {data.summary.distance.round2.team}
            </div>
          </div>
        )}
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Hero Damage</div>
          <div style={VALUE_STYLE} title={`${data.teams.team1} vs ${data.teams.team2}`}>
            {formatNumber(data.summary.team1Damage)} - {formatNumber(data.summary.team2Damage)}
          </div>
          <div style={SUB_STYLE}>
            {data.summary.team1Damage > data.summary.team2Damage ? data.teams.team1 : data.teams.team2} dealt more
          </div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Healing</div>
          <div style={VALUE_STYLE} title={`${data.teams.team1} vs ${data.teams.team2}`}>
            {formatNumber(data.summary.team1Healing)} - {formatNumber(data.summary.team2Healing)}
          </div>
          <div style={SUB_STYLE}>
            {data.summary.team1Healing > data.summary.team2Healing ? data.teams.team1 : data.teams.team2} healed more
          </div>
        </div>
      </div>

      {/* Stat Table */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '16px 20px 8px', fontWeight: 600, fontSize: '15px' }}>
          Player Stats
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--theme-elevation-150, #333)' }}>
                {(['name', 'hero', 'eliminations', 'assists', 'deaths', 'finalBlows', 'damage', 'healing'] as SortKey[]).map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    style={{
                      padding: '10px 12px',
                      textAlign: col === 'name' || col === 'hero' ? 'left' : 'right',
                      cursor: 'pointer',
                      fontWeight: sortKey === col ? 700 : 500,
                      color: sortKey === col ? 'var(--theme-text, #fff)' : 'var(--theme-text-secondary, #888)',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
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
              <tr>
                <td colSpan={8} style={{
                  padding: '8px 12px 4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--theme-success-500, #22c55e)',
                  background: 'rgba(34, 197, 94, 0.05)',
                }}>
                  {data.teams.team1}
                </td>
              </tr>
              {team1Players.map((p) => (
                <PlayerRow key={p.name + p.hero} player={p} onClick={() => setSelectedPlayer(p.name)} selected={selectedPlayer === p.name} />
              ))}
              {/* Team 2 */}
              <tr>
                <td colSpan={8} style={{
                  padding: '12px 12px 4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--theme-error-500, #ef4444)',
                  background: 'rgba(239, 68, 68, 0.05)',
                }}>
                  {data.teams.team2}
                </td>
              </tr>
              {team2Players.map((p) => (
                <PlayerRow key={p.name + p.hero} player={p} onClick={() => setSelectedPlayer(p.name)} selected={selectedPlayer === p.name} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analysis Section */}
      <div style={{ ...CARD_STYLE, marginBottom: '28px' }}>
        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '12px' }}>Fight Analysis</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div>
            📊 <strong>{data.analysis.totalFights}</strong> fights identified
          </div>
          <div>
            💀 {data.teams.team1} got first death in{' '}
            <span style={{ color: data.analysis.team1FirstDeathPct > 50 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
              {data.analysis.team1FirstDeathPct}%
            </span>{' '}
            of fights ({data.analysis.team1FirstDeaths}/{data.analysis.totalFights})
          </div>
          <div>
            💀 {data.teams.team2} got first death in{' '}
            <span style={{ color: data.analysis.team2FirstDeathPct > 50 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
              {data.analysis.team2FirstDeathPct}%
            </span>{' '}
            of fights ({data.analysis.team2FirstDeaths}/{data.analysis.totalFights})
          </div>
          <div>
            ⚡ Ultimate kills: {data.teams.team1}{' '}
            <strong>{data.analysis.team1UltKills}</strong> vs {data.teams.team2}{' '}
            <strong>{data.analysis.team2UltKills}</strong>
          </div>
        </div>
      </div>

      {/* Player Detail Card */}
      {selectedCalcStat && (
        <div style={{ ...CARD_STYLE, marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '18px' }}>{selectedCalcStat.playerName}</div>
              <div style={{ fontSize: '13px', color: 'var(--theme-text-secondary, #888)' }}>
                {selectedCalcStat.hero} · {selectedCalcStat.role}
              </div>
            </div>
            <button
              onClick={() => setSelectedPlayer(null)}
              style={{ background: 'none', border: 'none', color: 'var(--theme-text-secondary, #888)', cursor: 'pointer', fontSize: '18px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <StatMini label="First Pick %" value={`${selectedCalcStat.firstPickPercentage}%`} sub={`${selectedCalcStat.firstPickCount} picks`} />
            <StatMini label="First Death %" value={`${selectedCalcStat.firstDeathPercentage}%`} sub={`${selectedCalcStat.firstDeathCount} deaths`} />
            <StatMini label="Fleta Deadlift" value={`${selectedCalcStat.fletaDeadliftPercentage}%`} />
            <StatMini label="Fight Reversal" value={`${selectedCalcStat.fightReversalPercentage}%`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <StatMini label="Avg Ult Charge" value={`${selectedCalcStat.averageUltChargeTime}s`} />
            <StatMini label="Avg Ult Hold" value={`${selectedCalcStat.averageTimeToUseUlt}s`} />
            <StatMini label="Kills per Ult" value={`${selectedCalcStat.killsPerUltimate}`} />
            <StatMini label="Drought Time" value={`${selectedCalcStat.droughtTime}s`} sub="avg between kills" />
          </div>

          {selectedCalcStat.ajaxCount > 0 && (
            <div style={{ fontSize: '13px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', marginBottom: '16px' }}>
              🎺 <strong>{selectedCalcStat.ajaxCount}</strong> Ajax{selectedCalcStat.ajaxCount !== 1 ? 'es' : ''} (died during Lúcio ult)
            </div>
          )}

          {/* Duel Matchups */}
          {selectedCalcStat.duels.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Duel Matchups</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                {selectedCalcStat.duels.map((d, i) => (
                  <div
                    key={`${d.heroName}-${i}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'var(--theme-elevation-100, #2a2a2a)',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{d.heroName}</span>
                    <span style={{ color: d.winRate >= 50 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
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
            <div style={{ fontWeight: 600, fontSize: '15px' }}>
              Advanced Stats
              <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--theme-text-secondary, #888)', marginLeft: '8px' }}>
                Click a player row above for full detail
              </span>
            </div>
            <ColumnKeyToggle />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--theme-elevation-150, #333)' }}>
                  {['Player', 'Hero', 'FP%', 'FD%', 'Fleta%', 'Ult Charge', 'Ult Hold', 'K/Ult', 'Drought'].map((h) => (
                    <th key={h} style={{
                      padding: '8px 10px',
                      textAlign: h === 'Player' || h === 'Hero' ? 'left' : 'right',
                      fontWeight: 500,
                      color: 'var(--theme-text-secondary, #888)',
                      textTransform: 'uppercase',
                      fontSize: '10px',
                      letterSpacing: '0.3px',
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
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--theme-elevation-100, #2a2a2a)' }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 500 }}>{s.playerName}</td>
                    <td style={{ padding: '8px 10px' }}>{s.hero}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{s.firstPickPercentage}%</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{s.firstDeathPercentage}%</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{s.fletaDeadliftPercentage}%</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{s.averageUltChargeTime}s</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{s.averageTimeToUseUlt}s</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{s.killsPerUltimate}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{s.droughtTime}s</td>
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
          background: open ? 'var(--theme-elevation-200, #3a3a3a)' : 'var(--theme-elevation-100, #2a2a2a)',
          border: '1px solid var(--theme-elevation-200, #3a3a3a)',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          color: 'var(--theme-text-secondary, #aaa)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s',
        }}
        title="Show column definitions"
      >
        ℹ️ Key
      </button>
      {open && (
        <div style={{
          marginTop: '2px',
          position: 'absolute',
          right: 0,
          zIndex: 10,
          background: 'var(--theme-elevation-100, #2a2a2a)',
          border: '1px solid var(--theme-elevation-200, #3a3a3a)',
          borderRadius: '8px',
          padding: '12px 16px',
          minWidth: '340px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {entries.map(([abbr, desc]) => (
              <div key={abbr} style={{ display: 'flex', gap: '10px', fontSize: '12px', lineHeight: '1.4' }}>
                <span style={{ fontWeight: 700, color: 'var(--theme-text, #fff)', minWidth: '70px', flexShrink: 0 }}>{abbr}</span>
                <span style={{ color: 'var(--theme-text-secondary, #aaa)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Single stat table row */
function PlayerRow({ player, onClick, selected }: { player: PlayerRow; onClick: () => void; selected: boolean }) {
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid var(--theme-elevation-100, #2a2a2a)',
        background: selected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{player.name}</td>
      <td style={{ padding: '8px 12px' }}>{player.hero}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.eliminations}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.assists}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.deaths}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{player.finalBlows}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(player.damage)}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(player.healing)}</td>
    </tr>
  )
}

/** Mini stat card used in the player detail section */
function StatMini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '8px',
      background: 'var(--theme-elevation-100, #2a2a2a)',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--theme-text-secondary, #888)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--theme-text-secondary, #888)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}
