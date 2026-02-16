'use client'

import React, { useState, useEffect, useMemo } from 'react'

// Shared tokens
const CYAN = '#06b6d4'
const RED = '#ef4444'
const TEXT_PRIMARY = '#e2e8f0'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_DIM = '#64748b'
const BG_CARD = 'rgba(15, 23, 42, 0.6)'
const BORDER = 'rgba(148, 163, 184, 0.08)'
const GREEN = '#22c55e'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  borderRadius: '12px',
  padding: '20px 24px',
  border: `1px solid ${BORDER}`,
}

type KillEntry = {
  time: number
  attackerTeam: string
  attackerName: string
  attackerHero: string
  victimTeam: string
  victimName: string
  victimHero: string
  ability: string
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
  fights: FightData[]
}

export default function ChartsTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<KillfeedData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Reuse killfeed data for charts
    fetch(`/api/scrim-stats?mapId=${mapId}&tab=killfeed`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  // Build SVG chart data
  const chartData = useMemo(() => {
    if (!data || data.fights.length === 0) return null

    const team1 = data.teams.team1
    // Group kills into 15-second intervals across the entire match
    const allKills = data.fights.flatMap(f => f.kills)
    if (allKills.length === 0) return null

    const minTime = allKills[0].time
    const maxTime = allKills[allKills.length - 1].time
    const bucketSize = 15
    const buckets: { time: number; team1: number; team2: number }[] = []

    for (let t = minTime; t <= maxTime + bucketSize; t += bucketSize) {
      const killsInBucket = allKills.filter(k =>
        k.time >= t && k.time < t + bucketSize && k.ability !== 'Resurrect'
      )

      // Use camelCase property since this is API response data
      const t1 = killsInBucket.filter(k => k.attackerTeam === team1).length
      const t2 = killsInBucket.filter(k => k.attackerTeam !== team1).length

      buckets.push({ time: t, team1: t1, team2: -t2 })
    }

    return { buckets, minTime, maxTime }
  }, [data])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading charts…</div>
  if (!data || !chartData) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_DIM }}>No chart data available</div>

  const { buckets } = chartData
  const maxVal = Math.max(...buckets.map(b => Math.abs(b.team1)), ...buckets.map(b => Math.abs(b.team2)), 1)

  // SVG dimensions
  const W = 1100
  const H = 400
  const PAD = { top: 40, bottom: 60, left: 50, right: 30 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const midY = PAD.top + plotH / 2

  // Scale functions
  const xScale = (i: number) => PAD.left + (i / Math.max(buckets.length - 1, 1)) * plotW
  const yScale = (v: number) => midY - (v / maxVal) * (plotH / 2)

  // Build polyline points
  const team1Points = buckets.map((b, i) => `${xScale(i)},${yScale(b.team1)}`).join(' ')
  const team2Points = buckets.map((b, i) => `${xScale(i)},${yScale(b.team2)}`).join(' ')

  // Y-axis ticks
  const yTicks: number[] = []
  for (let v = -maxVal; v <= maxVal; v++) {
    if (v !== 0) yTicks.push(v)
  }
  yTicks.push(0)

  // X-axis labels (every 4th bucket)
  const xLabels = buckets.filter((_, i) => i % 4 === 0 || i === buckets.length - 1)

  return (
    <div>
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '4px' }}>
          Kills By Fight
          <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM, marginLeft: '8px' }}>ⓘ</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
          {/* Grid lines */}
          {yTicks.map(v => (
            <line key={v} x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)}
              stroke="rgba(148, 163, 184, 0.06)" strokeWidth={1} />
          ))}
          {/* Zero line */}
          <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY}
            stroke="rgba(148, 163, 184, 0.15)" strokeWidth={1} />

          {/* Y-axis labels */}
          {yTicks.filter(v => Number.isInteger(v)).map(v => (
            <text key={v} x={PAD.left - 10} y={yScale(v)} textAnchor="end" dominantBaseline="middle"
              fill={TEXT_DIM} fontSize={11}>{Math.abs(v)}</text>
          ))}

          {/* X-axis labels */}
          {xLabels.map((b) => {
            const idx = buckets.indexOf(b)
            return (
              <text key={b.time} x={xScale(idx)} y={H - PAD.bottom + 20} textAnchor="middle"
                fill={TEXT_DIM} fontSize={10}>{b.time.toFixed(0)}s</text>
            )
          })}

          {/* Team 1 line */}
          <polyline points={team1Points} fill="none" stroke={CYAN} strokeWidth={2} strokeLinejoin="round" />
          {buckets.map((b, i) => (
            <circle key={`t1-${i}`} cx={xScale(i)} cy={yScale(b.team1)} r={3} fill={CYAN} opacity={0.7} />
          ))}

          {/* Team 2 line */}
          <polyline points={team2Points} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" />
          {buckets.map((b, i) => (
            <circle key={`t2-${i}`} cx={xScale(i)} cy={yScale(b.team2)} r={3} fill={RED} opacity={0.7} />
          ))}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div style={{ width: '12px', height: '3px', background: CYAN, borderRadius: '2px' }} />
            <span style={{ color: TEXT_SECONDARY }}>{data.teams.team1}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div style={{ width: '12px', height: '3px', background: RED, borderRadius: '2px' }} />
            <span style={{ color: TEXT_SECONDARY }}>{data.teams.team2}</span>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '12px', lineHeight: 1.5 }}>
          Kills are grouped by 15 second intervals. The x-axis represents the time in seconds,
          and the y-axis represents the cumulative kills. {data.teams.team1} is represented with
          positive numbers, while {data.teams.team2} is represented with negative numbers.
        </p>
      </div>

      {/* Per-fight breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginTop: '20px' }}>
        {data.fights.map((fight) => {
          const t1Kills = fight.kills.filter(k => k.attackerTeam === data.teams.team1 && k.ability !== 'Resurrect').length
          const t2Kills = fight.kills.filter(k => k.attackerTeam === data.teams.team2 && k.ability !== 'Resurrect').length
          return (
            <div key={fight.fightNumber} style={{ ...CARD_STYLE, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Fight {fight.fightNumber}</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>
                <span style={{ color: GREEN }}>{t1Kills}</span>
                <span style={{ color: TEXT_DIM }}> – </span>
                <span style={{ color: RED }}>{t2Kills}</span>
              </div>
              <div style={{ fontSize: '11px', color: fight.winner === data.teams.team1 ? GREEN : fight.winner === data.teams.team2 ? RED : TEXT_DIM, fontWeight: 600, marginTop: '4px' }}>
                {fight.winner}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
