import React from 'react'
import type { LiveActivityEvent } from './types'

// ── Color tokens ──
const TEXT_DIM = '#52525b'

// Team palette: team1 = blue/cyan, team2 = orange/red
const TEAM_COLOR: Record<1 | 2, string> = {
  1: '#60a5fa', // blue-400
  2: '#fb923c', // orange-400
}

export function LiveActivityTicker({ events }: { events: LiveActivityEvent[] }) {
  if (events.length === 0) return null

  return (
    <div className="scrim-detail__card" style={{ padding: '12px 16px' }}>
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: TEXT_DIM,
          marginBottom: '8px',
        }}
      >
        Activity
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {events.map((ev, i) => (
          <li
            key={i}
            style={{
              fontSize: '11px',
              color: ev.kind === 'kill' ? TEAM_COLOR[ev.team] : TEXT_DIM,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {ev.kind === 'kill' ? `${ev.player} got a kill` : `${ev.player} died`}
          </li>
        ))}
      </ul>
    </div>
  )
}
