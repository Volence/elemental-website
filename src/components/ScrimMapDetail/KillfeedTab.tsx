'use client'

import React, { useState, useEffect } from 'react'

// ── Design tokens (shared) ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const TEXT_PRIMARY = '#e2e8f0'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_DIM = '#64748b'
const BG_CARD = 'rgba(15, 23, 42, 0.6)'
const BORDER = 'rgba(148, 163, 184, 0.08)'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  borderRadius: '12px',
  padding: '20px 24px',
  border: `1px solid ${BORDER}`,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: TEXT_SECONDARY,
}

// ── Types ──
type KillEntry = {
  time: number
  attackerTeam: string
  attackerName: string
  attackerHero: string
  victimTeam: string
  victimName: string
  victimHero: string
  ability: string
  damage: number
  isCritical: boolean
  isEnvironmental: boolean
}

type FightData = {
  fightNumber: number
  start: number
  end: number
  winner: string
  kills: KillEntry[]
}

type KillfeedData = {
  teams: { team1: string; team2: string }
  matchTime: number
  team1Kills: number
  team2Kills: number
  team1Deaths: number
  team2Deaths: number
  team1FightWins: number
  team2FightWins: number
  fights: FightData[]
}

function toTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export default function KillfeedTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<KillfeedData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/scrim-stats?mapId=${mapId}&tab=killfeed`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading killfeed…</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: RED }}>Failed to load killfeed</div>

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Total Match Time</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: TEXT_PRIMARY, marginTop: '6px' }}>{toTimestamp(data.matchTime)}</div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{(data.matchTime / 60).toFixed(1)} minutes</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Kills</div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '6px' }}>
            <span style={{ color: GREEN }}>{data.team1Kills}</span>
            <span style={{ color: TEXT_DIM }}> / </span>
            <span style={{ color: RED }}>{data.team2Kills}</span>
          </div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{data.teams.team1} / {data.teams.team2}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Deaths</div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '6px' }}>
            <span style={{ color: GREEN }}>{data.team1Deaths}</span>
            <span style={{ color: TEXT_DIM }}> / </span>
            <span style={{ color: RED }}>{data.team2Deaths}</span>
          </div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{data.teams.team1} / {data.teams.team2}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Fight Wins</div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '6px' }}>
            <span style={{ color: GREEN }}>{data.team1FightWins}</span>
            <span style={{ color: TEXT_DIM }}> / </span>
            <span style={{ color: RED }}>{data.team2FightWins}</span>
          </div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{data.teams.team1} / {data.teams.team2}</div>
        </div>
      </div>

      {/* Killfeed Table */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 10px', fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}` }}>
          Killfeed
        </div>

        {data.fights.map((fight) => (
          <div key={fight.fightNumber}>
            {/* Fight kills */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ ...thStyle, textAlign: 'left', width: '100px' }}>Time</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Kill</th>
                  <th style={{ ...thStyle, textAlign: 'left', width: '140px' }}>Method</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '80px' }}>Start</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '80px' }}>End</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '100px' }}>Fight Winner</th>
                </tr>
              </thead>
              <tbody>
                {fight.kills.map((kill, ki) => (
                  <tr key={ki} style={{ borderBottom: `1px solid ${BORDER}`, transition: 'background 0.15s' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', color: TEXT_DIM }}>
                      {kill.time.toFixed(2)} ({toTimestamp(kill.time)})
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontWeight: 600, color: kill.attackerTeam === data.teams.team1 ? GREEN : RED }}>
                        {kill.attackerName}
                      </span>
                      <span style={{ color: TEXT_DIM, fontSize: '11px', margin: '0 6px' }}>
                        ({kill.attackerHero})
                      </span>
                      <span style={{ color: TEXT_DIM, margin: '0 6px' }}>
                        {kill.ability === 'Resurrect' ? '💚' : '→'}
                      </span>
                      <span style={{ fontWeight: 600, color: kill.victimTeam === data.teams.team1 ? GREEN : RED }}>
                        {kill.victimName}
                      </span>
                      <span style={{ color: TEXT_DIM, fontSize: '11px', margin: '0 6px' }}>
                        ({kill.victimHero})
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: TEXT_SECONDARY, fontSize: '12px' }}>
                      {kill.ability}
                      {kill.isCritical && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>💥</span>}
                      {kill.isEnvironmental && <span style={{ color: CYAN, marginLeft: '4px' }}>🌊</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: TEXT_DIM, fontSize: '12px' }}>
                      {ki === 0 ? toTimestamp(fight.start) : ''}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: TEXT_DIM, fontSize: '12px' }}>
                      {ki === 0 ? toTimestamp(fight.end) : ''}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontSize: '12px', color: fight.winner === data.teams.team1 ? GREEN : fight.winner === data.teams.team2 ? RED : TEXT_DIM }}>
                      {ki === 0 ? fight.winner : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Fight separator */}
            <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '11px', color: TEXT_DIM, background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${BORDER}` }}>
              Fight {fight.fightNumber}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontWeight: 600,
  color: TEXT_SECONDARY,
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}
