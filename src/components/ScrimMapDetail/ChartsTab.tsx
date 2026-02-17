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

type ChartsAPIData = {
  teams: { team1: string; team2: string }
  finalBlowsByRole: {
    Tank: { team1: number; team2: number }
    Damage: { team1: number; team2: number }
    Support: { team1: number; team2: number }
  }
  damageByRound: { round: number; team1Damage: number; team2Damage: number }[]
}

export default function ChartsTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<KillfeedData | null>(null)
  const [chartsData, setChartsData] = useState<ChartsAPIData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/scrim-stats?mapId=${mapId}&tab=killfeed`).then(r => r.json()),
      fetch(`/api/scrim-stats?mapId=${mapId}&tab=charts`).then(r => r.json()),
    ])
      .then(([killfeed, charts]) => {
        setData(killfeed)
        setChartsData(charts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  // Build SVG chart data for kills-by-fight
  const chartData = useMemo(() => {
    if (!data || data.fights.length === 0) return null

    const team1 = data.teams.team1
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

  // SVG dimensions for kills chart
  const W = 1100
  const H = 400
  const PAD = { top: 40, bottom: 60, left: 50, right: 30 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const midY = PAD.top + plotH / 2

  const xScale = (i: number) => PAD.left + (i / Math.max(buckets.length - 1, 1)) * plotW
  const yScale = (v: number) => midY - (v / maxVal) * (plotH / 2)

  const team1Points = buckets.map((b, i) => `${xScale(i)},${yScale(b.team1)}`).join(' ')
  const team2Points = buckets.map((b, i) => `${xScale(i)},${yScale(b.team2)}`).join(' ')

  const yTicks: number[] = []
  for (let v = -maxVal; v <= maxVal; v++) {
    if (v !== 0) yTicks.push(v)
  }
  yTicks.push(0)

  const xLabels = buckets.filter((_, i) => i % 4 === 0 || i === buckets.length - 1)

  return (
    <div>
      {/* ── Kills By Fight Line Chart ── */}
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '4px' }}>
          Kills By Fight
          <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM, marginLeft: '8px' }}>ⓘ</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
          {yTicks.map(v => (
            <line key={v} x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)}
              stroke="rgba(148, 163, 184, 0.06)" strokeWidth={1} />
          ))}
          <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY}
            stroke="rgba(148, 163, 184, 0.15)" strokeWidth={1} />

          {yTicks.filter(v => Number.isInteger(v)).map(v => (
            <text key={v} x={PAD.left - 10} y={yScale(v)} textAnchor="end" dominantBaseline="middle"
              fill={TEXT_DIM} fontSize={11}>{Math.abs(v)}</text>
          ))}

          {xLabels.map((b) => {
            const idx = buckets.indexOf(b)
            return (
              <text key={b.time} x={xScale(idx)} y={H - PAD.bottom + 20} textAnchor="middle"
                fill={TEXT_DIM} fontSize={10}>{b.time.toFixed(0)}s</text>
            )
          })}

          <polyline points={team1Points} fill="none" stroke={CYAN} strokeWidth={2} strokeLinejoin="round" />
          {buckets.map((b, i) => (
            <circle key={`t1-${i}`} cx={xScale(i)} cy={yScale(b.team1)} r={3} fill={CYAN} opacity={0.7} />
          ))}

          <polyline points={team2Points} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" />
          {buckets.map((b, i) => (
            <circle key={`t2-${i}`} cx={xScale(i)} cy={yScale(b.team2)} r={3} fill={RED} opacity={0.7} />
          ))}
        </svg>

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

      {/* ── Per-fight breakdown cards ── */}
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

      {/* ── Final Blows By Role + Cumulative Damage ── */}
      {chartsData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          {/* Final Blows By Role Bar Chart */}
          <FinalBlowsByRoleChart data={chartsData} />
          {/* Cumulative Hero Damage By Round Area Chart */}
          <CumulativeDamageChart data={chartsData} />
        </div>
      )}
    </div>
  )
}

// ── Final Blows By Role (Bar Chart) ──
function FinalBlowsByRoleChart({ data }: { data: ChartsAPIData }) {
  const roles = ['Tank', 'Damage', 'Support'] as const
  const maxFB = Math.max(
    ...roles.map(r => data.finalBlowsByRole[r].team1),
    ...roles.map(r => data.finalBlowsByRole[r].team2),
    1
  )

  const W = 500
  const H = 320
  const PAD = { top: 30, bottom: 40, left: 40, right: 20 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const barGroupWidth = plotW / roles.length
  const barWidth = barGroupWidth * 0.3
  const gap = barGroupWidth * 0.1

  // Y-axis ticks
  const yTickCount = Math.min(maxFB, 6)
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxFB / yTickCount) * i))

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '4px' }}>
        Final Blows By Role
        <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM, marginLeft: '8px' }}>ⓘ</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Y-axis grid lines and labels */}
        {yTicks.map(v => {
          const y = PAD.top + plotH - (v / maxFB) * plotH
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="rgba(148, 163, 184, 0.06)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle"
                fill={TEXT_DIM} fontSize={11}>{v}</text>
            </g>
          )
        })}
        {/* Bottom axis line */}
        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH}
          stroke="rgba(148, 163, 184, 0.15)" strokeWidth={1} />

        {/* Bars */}
        {roles.map((role, i) => {
          const groupX = PAD.left + i * barGroupWidth + barGroupWidth / 2
          const t1Val = data.finalBlowsByRole[role].team1
          const t2Val = data.finalBlowsByRole[role].team2
          const t1Height = (t1Val / maxFB) * plotH
          const t2Height = (t2Val / maxFB) * plotH

          return (
            <g key={role}>
              {/* Team 1 bar */}
              <rect
                x={groupX - barWidth - gap / 2}
                y={PAD.top + plotH - t1Height}
                width={barWidth}
                height={t1Height}
                fill={CYAN}
                rx={2}
              />
              {/* Team 2 bar */}
              <rect
                x={groupX + gap / 2}
                y={PAD.top + plotH - t2Height}
                width={barWidth}
                height={t2Height}
                fill={RED}
                rx={2}
              />
              {/* Role label */}
              <text x={groupX} y={H - PAD.bottom + 20} textAnchor="middle"
                fill={TEXT_DIM} fontSize={11}>{role}</text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <div style={{ width: '10px', height: '10px', background: CYAN, borderRadius: '2px' }} />
          <span style={{ color: TEXT_SECONDARY }}>{data.teams.team1}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <div style={{ width: '10px', height: '10px', background: RED, borderRadius: '2px' }} />
          <span style={{ color: TEXT_SECONDARY }}>{data.teams.team2}</span>
        </div>
      </div>

      <p style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '8px', lineHeight: 1.5 }}>
        This chart shows the number of final blows by role for each team. The roles are split into Tank, Damage, and Support.
        The x-axis represents the role, and the y-axis represents the number of final blows.
      </p>
    </div>
  )
}

// ── Cumulative Hero Damage By Round (Area Chart) ──
function CumulativeDamageChart({ data }: { data: ChartsAPIData }) {
  const rounds = data.damageByRound
  if (rounds.length === 0) return null

  // Build cumulative sums
  const cumulative = rounds.reduce<{ round: number; team1: number; team2: number }[]>((acc, r, i) => {
    const prev = i > 0 ? acc[i - 1] : { team1: 0, team2: 0 }
    acc.push({
      round: r.round,
      team1: prev.team1 + r.team1Damage,
      team2: prev.team2 + r.team2Damage,
    })
    return acc
  }, [])

  const maxDmg = Math.max(...cumulative.map(c => c.team1), ...cumulative.map(c => c.team2), 1)

  const W = 500
  const H = 320
  const PAD = { top: 30, bottom: 40, left: 60, right: 20 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const xScale = (i: number) => PAD.left + (i / Math.max(cumulative.length - 1, 1)) * plotW
  const yScale = (v: number) => PAD.top + plotH - (v / maxDmg) * plotH

  // Build polylines and area paths
  const t1Line = cumulative.map((c, i) => `${xScale(i)},${yScale(c.team1)}`).join(' ')
  const t2Line = cumulative.map((c, i) => `${xScale(i)},${yScale(c.team2)}`).join(' ')

  // Area fill paths (polygon from line to bottom)
  const t1Area = `${PAD.left},${PAD.top + plotH} ` + t1Line + ` ${xScale(cumulative.length - 1)},${PAD.top + plotH}`
  const t2Area = `${PAD.left},${PAD.top + plotH} ` + t2Line + ` ${xScale(cumulative.length - 1)},${PAD.top + plotH}`

  // Y-axis ticks
  const yTickCount = 4
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxDmg / yTickCount) * i))

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '4px' }}>
        Cumulative Hero Damage By Round
        <span style={{ fontWeight: 400, fontSize: '12px', color: TEXT_DIM, marginLeft: '8px' }}>ⓘ</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Y-axis grid lines */}
        {yTicks.map(v => {
          const y = yScale(v)
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="rgba(148, 163, 184, 0.06)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle"
                fill={TEXT_DIM} fontSize={10}>{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}</text>
            </g>
          )
        })}

        {/* Vertical round dividers */}
        {cumulative.map((_, i) => (
          <line key={i} x1={xScale(i)} y1={PAD.top} x2={xScale(i)} y2={PAD.top + plotH}
            stroke="rgba(148, 163, 184, 0.06)" strokeWidth={1} strokeDasharray="4,4" />
        ))}

        {/* Team 1 area fill */}
        <polygon points={t1Area} fill={CYAN} opacity={0.12} />
        {/* Team 2 area fill */}
        <polygon points={t2Area} fill={RED} opacity={0.12} />

        {/* Team 1 line */}
        <polyline points={t1Line} fill="none" stroke={CYAN} strokeWidth={2} strokeLinejoin="round" />
        {cumulative.map((c, i) => (
          <circle key={`t1-${i}`} cx={xScale(i)} cy={yScale(c.team1)} r={3} fill={CYAN} />
        ))}

        {/* Team 2 line */}
        <polyline points={t2Line} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" />
        {cumulative.map((c, i) => (
          <circle key={`t2-${i}`} cx={xScale(i)} cy={yScale(c.team2)} r={3} fill={RED} />
        ))}

        {/* X-axis labels */}
        {cumulative.map((c, i) => (
          <text key={i} x={xScale(i)} y={H - PAD.bottom + 20} textAnchor="middle"
            fill={TEXT_DIM} fontSize={10}>Round {c.round}</text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <div style={{ width: '12px', height: '3px', background: CYAN, borderRadius: '2px' }} />
          <span style={{ color: TEXT_SECONDARY }}>{data.teams.team1}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <div style={{ width: '12px', height: '3px', background: RED, borderRadius: '2px' }} />
          <span style={{ color: TEXT_SECONDARY }}>{data.teams.team2}</span>
        </div>
      </div>

      <p style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '8px', lineHeight: 1.5 }}>
        This chart shows the hero damage done by round for each team. The x-axis represents the round,
        and the y-axis represents the damage done. Note that the damage done in round 2 includes the
        damage done in round 1.
      </p>
    </div>
  )
}
