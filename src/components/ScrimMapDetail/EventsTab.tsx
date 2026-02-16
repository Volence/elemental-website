'use client'

import React, { useState, useEffect } from 'react'

const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
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

type MatchEvent = {
  time: number
  type: string
  description: string
  team?: string
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

const EVENT_ICONS: Record<string, string> = {
  match_start: '🏁',
  round_start: '▶️',
  round_end: '⏹️',
  objective_captured: '🏳️',
}

export default function EventsTab({ mapId }: { mapId: string }) {
  const [data, setData] = useState<EventsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/scrim-stats?mapId=${mapId}&tab=events`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mapId])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>Loading events…</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: RED }}>Failed to load events</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Match Events */}
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '16px' }}>
          Match Events
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.matchEvents.map((event, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${BORDER}`,
              transition: 'background 0.15s',
            }}>
              <div style={{ fontSize: '16px', marginTop: '1px', flexShrink: 0 }}>
                {EVENT_ICONS[event.type] || '📌'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: TEXT_PRIMARY, fontWeight: 500 }}>
                  {event.description}
                </div>
                <div style={{ fontSize: '11px', color: TEXT_DIM, marginTop: '2px', fontFamily: 'monospace' }}>
                  {toTimestamp(event.time)}
                </div>
              </div>
              {event.team && (
                <div style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: event.team === data.teams.team1 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: event.team === data.teams.team1 ? GREEN : RED,
                  flexShrink: 0,
                }}>
                  {event.team}
                </div>
              )}
            </div>
          ))}
          {data.matchEvents.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: TEXT_DIM, fontSize: '13px' }}>
              No match events recorded
            </div>
          )}
        </div>
      </div>

      {/* Ultimates Used */}
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_PRIMARY, marginBottom: '4px' }}>
          Ultimates Used
        </div>
        <div style={{ fontSize: '12px', color: TEXT_DIM, marginBottom: '16px' }}>
          {data.ultimates.length} ultimate{data.ultimates.length !== 1 ? 's' : ''} activated
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '600px', overflowY: 'auto' }}>
          {data.ultimates.map((ult, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${BORDER}`,
              transition: 'background 0.15s',
            }}>
              <div style={{ fontSize: '14px', flexShrink: 0 }}>⚡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: TEXT_PRIMARY }}>
                  <span style={{
                    fontWeight: 600,
                    color: ult.team === data.teams.team1 ? GREEN : RED,
                  }}>
                    {ult.player}
                  </span>
                  <span style={{ color: TEXT_DIM, marginLeft: '6px', fontSize: '11px' }}>
                    ({ult.hero})
                  </span>
                </div>
              </div>
              <div style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: PURPLE,
                flexShrink: 0,
              }}>
                {toTimestamp(ult.time)}
                {ult.endTime && (
                  <span style={{ color: TEXT_DIM }}>
                    {' → '}{toTimestamp(ult.endTime)}
                  </span>
                )}
              </div>
            </div>
          ))}
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
