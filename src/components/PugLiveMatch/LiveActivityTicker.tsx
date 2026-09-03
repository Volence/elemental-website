import React from 'react'
import type { LiveActivityEvent } from './types'

// ── Color tokens (site theme variables so the panel follows light and dark) ──
const TEXT_DIM = 'hsl(var(--muted-foreground) / 0.7)'

// Team palette: team1 = blue/cyan, team2 = orange/red
const TEAM_COLOR: Record<1 | 2, string> = {
  1: '#60a5fa', // blue-400
  2: '#fb923c', // orange-400
}

export function LiveActivityTicker({ events }: { events: LiveActivityEvent[] }) {
  if (events.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md" style={{ padding: '12px 16px' }}>
      <div
        style={{
          fontSize: '12px',
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
              fontSize: '12px',
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
