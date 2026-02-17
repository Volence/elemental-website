'use client'

import React, { useState, useEffect } from 'react'
import { getHeroIconUrl, loadHeroPortraits } from '@/lib/scrim-parser/heroIcons'

// ── Clean Glow Design Tokens ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const TEXT_PRIMARY = '#e2e8f0'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_DIM = '#64748b'

// ── Hero Icon with Team-Colored Glow Border ──
function HeroIcon({ hero, teamColor }: { hero: string; teamColor: string }) {
  const [failed, setFailed] = useState(false)
  const size = 26
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
          fontSize: '11px',
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

// ── Styled Event Type Icons (replacing emojis) ──
function EventIcon({ type }: { type: string }) {
  const iconMap: Record<string, { symbol: string; color: string }> = {
    match_start: { symbol: '▸', color: GREEN },
    round_start: { symbol: '▸', color: AMBER },
    round_end: { symbol: '■', color: RED },
    objective_captured: { symbol: '⬤', color: CYAN },
    point_captured: { symbol: '⬤', color: CYAN },
    multikill: { symbol: '✦', color: PURPLE },
    ultimate_kill: { symbol: '⚡', color: AMBER },
  }
  const icon = iconMap[type] || { symbol: '•', color: TEXT_DIM }

  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '4px',
        background: `${icon.color}12`,
        border: `1px solid ${icon.color}33`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        color: icon.color,
        flexShrink: 0,
      }}
    >
      {icon.symbol}
    </div>
  )
}

// ── Types ──
type MatchEvent = {
  time: number
  type: string
  description: string
  team?: string
  player?: string
  hero?: string
}

type UltimateEntry = {
  time: number
  team: string
  player: string
  hero: string
  ultimateId: number
  endTime: number | null
}

type EventsData = {
  teams: { team1: string; team2: string }
  matchEvents: MatchEvent[]
  ultimates: UltimateEntry[]
}

function toTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

// Helper: extract player names from event descriptions to add hero icons
function parsePlayersFromDescription(desc: string, teams: { team1: string; team2: string }): { name: string; team: string } | null {
  // Patterns like "Player got a multikill" or "Player killed..."
  const patterns = [
    /^(?:During fight \d+, )?(.+?) got a multikill/,
    /^(.+?) killed .+ with\/during their ultimate/,
    /^(.+?) used their ultimate/,
  ]
  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match) {
      return { name: match[1].trim(), team: '' }
    }
  }
  return null
}

export default function EventsTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<EventsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/scrim-stats?mapId=${mapId}&tab=events`).then((r) => r.json()),
      loadHeroPortraits(),
    ])
      .then(([d]) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading events…</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: RED }}>Failed to load events</div>

  const BORDER_SUBTLE = 'rgba(148, 163, 184, 0.06)'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* ── Match Events ── */}
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
            padding: '14px 20px 12px',
            fontWeight: 700,
            fontSize: '15px',
            color: TEXT_PRIMARY,
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
            background: 'rgba(6, 182, 212, 0.03)',
            position: 'relative',
          }}
        >
          {/* Left accent bar */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '3px',
              background: CYAN,
              boxShadow: `0 0 8px ${CYAN}66`,
            }}
          />
          Match Events
        </div>

        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {data.matchEvents.map((event, i) => {
            const playerInfo = parsePlayersFromDescription(event.description, data.teams)
            const teamColor = event.team === data.teams.team1 ? GREEN : event.team === data.teams.team2 ? RED : TEXT_DIM

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.015)',
                  border: `1px solid ${BORDER_SUBTLE}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6, 182, 212, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
              >
                <EventIcon type={event.type} />

                {/* Hero icon if we can identify a player */}
                {playerInfo && event.hero && (
                  <HeroIcon hero={event.hero} teamColor={teamColor} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: TEXT_PRIMARY, fontWeight: 500, lineHeight: '1.3' }}>
                    {event.description}
                  </div>
                  <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px', fontFamily: 'monospace' }}>
                    {toTimestamp(event.time)}
                  </div>
                </div>

                {event.team && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${teamColor}14`,
                      border: `1px solid ${teamColor}30`,
                      color: teamColor,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {event.team}
                  </div>
                )}
              </div>
            )
          })}
          {data.matchEvents.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: TEXT_DIM, fontSize: '13px' }}>
              No match events recorded
            </div>
          )}
        </div>
      </div>

      {/* ── Ultimates Used ── */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(6px)',
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px 12px',
            fontWeight: 700,
            fontSize: '15px',
            color: TEXT_PRIMARY,
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
            background: 'rgba(139, 92, 246, 0.03)',
            position: 'relative',
          }}
        >
          {/* Left accent bar */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '3px',
              background: PURPLE,
              boxShadow: `0 0 8px ${PURPLE}66`,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Ultimates Used
            <span style={{ fontSize: '12px', fontWeight: 400, color: TEXT_DIM }}>
              {data.ultimates.length} ultimate{data.ultimates.length !== 1 ? 's' : ''} activated
            </span>
          </div>
        </div>

        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '600px',
            overflowY: 'auto',
          }}
        >
          {data.ultimates.map((ult, i) => {
            const teamColor = ult.team === data.teams.team1 ? GREEN : RED

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.015)',
                  border: `1px solid ${BORDER_SUBTLE}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
              >
                {/* Ult icon */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '4px',
                    background: `${AMBER}12`,
                    border: `1px solid ${AMBER}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: AMBER,
                    flexShrink: 0,
                  }}
                >
                  ⚡
                </div>

                {/* Hero portrait */}
                <HeroIcon hero={ult.hero} teamColor={teamColor} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: teamColor,
                        textShadow: `0 0 8px ${teamColor}33`,
                      }}
                    >
                      {ult.player}
                    </span>
                    <span style={{ color: TEXT_DIM, fontSize: '11px' }}>
                      ({ult.hero})
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: PURPLE,
                    flexShrink: 0,
                    textShadow: `0 0 8px ${PURPLE}33`,
                  }}
                >
                  {toTimestamp(ult.time)}
                  {ult.endTime && (
                    <span style={{ color: TEXT_DIM }}>
                      {' → '}{toTimestamp(ult.endTime)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {data.ultimates.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: TEXT_DIM, fontSize: '13px' }}>
              No ultimate data recorded
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
