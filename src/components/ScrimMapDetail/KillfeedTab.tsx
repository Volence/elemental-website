'use client'

import React, { useState, useEffect } from 'react'
import { getHeroIconUrl, formatAbility, loadHeroPortraits } from '@/lib/scrim-parser/heroIcons'

// ── Clean Glow Design Tokens ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const TEXT_PRIMARY = '#e2e8f0'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_DIM = '#64748b'

// Clean glow: ultra-transparent backgrounds with glowing borders
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.05)',
  backdropFilter: 'blur(6px)',
  borderRadius: '12px',
  padding: '20px 24px',
  border: `1px solid rgba(6, 182, 212, 0.15)`,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  color: TEXT_SECONDARY,
}

// ── Hero Icon with Team-Colored Glow Border ──
function HeroIcon({ hero, teamColor }: { hero: string; teamColor: string }) {
  const [failed, setFailed] = useState(false)
  const size = 28
  const url = getHeroIconUrl(hero)

  const borderStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '4px',
    border: `2px solid ${teamColor}`,
    boxShadow: `0 0 6px ${teamColor}44`,
    flexShrink: 0,
    overflow: 'hidden',
  }

  if (failed || !url) {
    return (
      <div
        title={hero}
        style={{
          ...borderStyle,
          background: `${teamColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: teamColor,
        }}
      >
        {hero.charAt(0)}
      </div>
    )
  }

  return (
    <div style={borderStyle}>
      <img
        src={url}
        alt={hero}
        title={hero}
        width={size - 4}
        height={size - 4}
        onError={() => setFailed(true)}
        style={{
          borderRadius: '2px',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  )
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

// ── Summary stat card with left accent glow bar ──
function StatCard({
  label,
  children,
  accentColor,
}: {
  label: string
  children: React.ReactNode
  accentColor: string
}) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        position: 'relative',
        paddingLeft: '28px',
        overflow: 'hidden',
      }}
    >
      {/* Glow accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          background: accentColor,
          boxShadow: `0 0 8px ${accentColor}66`,
          borderRadius: '12px 0 0 12px',
        }}
      />
      <div style={LABEL_STYLE}>{label}</div>
      {children}
    </div>
  )
}

export default function KillfeedTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<KillfeedData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/scrim-stats?mapId=${mapId}&tab=killfeed`).then((r) => r.json()),
      loadHeroPortraits(),
    ])
      .then(([d]) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading killfeed…</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: RED }}>Failed to load killfeed</div>

  const BORDER_SUBTLE = 'rgba(148, 163, 184, 0.06)'

  return (
    <div>
      {/* Summary Cards with accent bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <StatCard label="Total Match Time" accentColor={CYAN}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: TEXT_PRIMARY, marginTop: '6px' }}>{toTimestamp(data.matchTime)}</div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{(data.matchTime / 60).toFixed(1)} minutes</div>
        </StatCard>
        <StatCard label="Kills" accentColor={GREEN}>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '6px' }}>
            <span style={{ color: GREEN }}>{data.team1Kills}</span>
            <span style={{ color: TEXT_DIM }}> / </span>
            <span style={{ color: RED }}>{data.team2Kills}</span>
          </div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{data.teams.team1} / {data.teams.team2}</div>
        </StatCard>
        <StatCard label="Deaths" accentColor={RED}>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '6px' }}>
            <span style={{ color: GREEN }}>{data.team1Deaths}</span>
            <span style={{ color: TEXT_DIM }}> / </span>
            <span style={{ color: RED }}>{data.team2Deaths}</span>
          </div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{data.teams.team1} / {data.teams.team2}</div>
        </StatCard>
        <StatCard label="Fight Wins" accentColor="#a855f7">
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '6px' }}>
            <span style={{ color: GREEN }}>{data.team1FightWins}</span>
            <span style={{ color: TEXT_DIM }}> / </span>
            <span style={{ color: RED }}>{data.team2FightWins}</span>
          </div>
          <div style={{ fontSize: '12px', color: TEXT_DIM, marginTop: '4px' }}>{data.teams.team1} / {data.teams.team2}</div>
        </StatCard>
      </div>

      {/* Killfeed Table with glass effect */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(6px)',
          borderRadius: '12px',
          border: '1px solid rgba(6, 182, 212, 0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px 10px',
            fontWeight: 700,
            fontSize: '15px',
            color: TEXT_PRIMARY,
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
            background: 'rgba(6, 182, 212, 0.03)',
          }}
        >
          Killfeed
        </div>

        {data.fights.map((fight) => (
          <div key={fight.fightNumber}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
                  <th style={{ ...thStyle, textAlign: 'left', width: '100px' }}>Time</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Kill</th>
                  <th style={{ ...thStyle, textAlign: 'left', width: '140px' }}>Method</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '80px' }}>Start</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '80px' }}>End</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: '100px' }}>Fight Winner</th>
                </tr>
              </thead>
              <tbody>
                {fight.kills.map((kill, ki) => {
                  const attackerColor = kill.attackerTeam === data.teams.team1 ? GREEN : RED
                  const victimColor = kill.victimTeam === data.teams.team1 ? GREEN : RED

                  return (
                    <tr
                      key={ki}
                      style={{
                        borderBottom: `1px solid ${BORDER_SUBTLE}`,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6, 182, 212, 0.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', color: TEXT_DIM }}>
                        {kill.time.toFixed(2)} ({toTimestamp(kill.time)})
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                          <HeroIcon hero={kill.attackerHero} teamColor={attackerColor} />
                          <span style={{ fontWeight: 600, color: attackerColor, textShadow: `0 0 8px ${attackerColor}33` }}>
                            {kill.attackerName}
                          </span>
                          <span style={{ color: TEXT_DIM, margin: '0 2px', fontSize: '14px' }}>
                            {kill.ability === 'Resurrect' ? '💚' : '→'}
                          </span>
                          <HeroIcon hero={kill.victimHero} teamColor={victimColor} />
                          <span style={{ fontWeight: 600, color: victimColor, textShadow: `0 0 8px ${victimColor}33` }}>
                            {kill.victimName}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: TEXT_SECONDARY, fontSize: '12px' }}>
                        {formatAbility(kill.ability)}
                        {kill.isCritical && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>💥</span>}
                        {kill.isEnvironmental && <span style={{ color: CYAN, marginLeft: '4px' }}>🌊</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: TEXT_DIM, fontSize: '12px' }}>
                        {ki === 0 ? toTimestamp(fight.start) : ''}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: TEXT_DIM, fontSize: '12px' }}>
                        {ki === 0 ? toTimestamp(fight.end) : ''}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontSize: '12px',
                          color: fight.winner === data.teams.team1 ? GREEN : fight.winner === data.teams.team2 ? RED : TEXT_DIM,
                        }}
                      >
                        {ki === 0 ? fight.winner : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Fight separator with subtle glow */}
            <div
              style={{
                textAlign: 'center',
                padding: '8px 0',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.5px',
                color: CYAN,
                background: 'rgba(6, 182, 212, 0.04)',
                borderBottom: `1px solid ${BORDER_SUBTLE}`,
                textShadow: `0 0 12px ${CYAN}44`,
              }}
            >
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
