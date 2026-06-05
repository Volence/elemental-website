import React from 'react'
import type { LiveSnapshot } from './types'

// ── Color tokens (mirrored from PlayerStatsTable / ScrimMapDetail) ──
const CYAN = '#06b6d4'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'
const BORDER = 'rgba(255, 255, 255, 0.06)'

// Team palette: team1 = blue/cyan, team2 = orange/red (matches inline scoreboard)
const T1_COLOR = '#60a5fa' // blue-400
const T2_COLOR = '#fb923c' // orange-400

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function LiveSummary({
  snapshot,
  displayMatchTime,
}: {
  snapshot: LiveSnapshot
  displayMatchTime: number
}) {
  return (
    <div
      className="scrim-detail__card"
      style={{
        padding: '16px 20px',
        marginBottom: '20px',
        borderLeft: `3px solid ${CYAN}`,
      }}
    >
      {/* Top row: LIVE dot + map info + timer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        {/* LIVE indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: '#22c55e',
                opacity: 0.75,
                animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                borderRadius: '50%',
                width: '8px',
                height: '8px',
                background: '#22c55e',
              }}
            />
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#22c55e',
            }}
          >
            Live
          </span>
          {(snapshot.map || snapshot.mapType) && (
            <span style={{ fontSize: '12px', color: TEXT_SECONDARY, marginLeft: '8px' }}>
              {snapshot.map ?? ''}
              {snapshot.mapType && (
                <span style={{ color: TEXT_DIM }}>{snapshot.map ? ' · ' : ''}{snapshot.mapType}</span>
              )}
            </span>
          )}
        </div>

        {/* Timer + round */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: TEXT_DIM }}>
          {snapshot.round > 0 && (
            <span style={{ color: TEXT_SECONDARY }}>Round {snapshot.round}</span>
          )}
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              color: TEXT_PRIMARY,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtTime(displayMatchTime)}
          </span>
        </div>
      </div>

      {/* Score line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '10px 0',
          borderTop: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 700, color: T1_COLOR }}>
          {snapshot.team1.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: T1_COLOR, fontVariantNumeric: 'tabular-nums' }}>
            {snapshot.team1.score}
          </span>
          <span style={{ fontSize: '18px', color: TEXT_DIM }}>—</span>
          <span style={{ fontSize: '26px', fontWeight: 900, color: T2_COLOR, fontVariantNumeric: 'tabular-nums' }}>
            {snapshot.team2.score}
          </span>
        </div>
        <span style={{ fontSize: '14px', fontWeight: 700, color: T2_COLOR }}>
          {snapshot.team2.name}
        </span>
      </div>
    </div>
  )
}
