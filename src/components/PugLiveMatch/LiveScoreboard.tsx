import React from 'react'
import type { LiveSnapshot, LiveLeaders, TeamKey } from './types'

// ── Color tokens ──
const CYAN = '#06b6d4'
const CYAN_DIM = 'rgba(6, 182, 212, 0.12)'
const GREEN = '#22c55e'
const RED = '#ef4444'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'
const BORDER = 'rgba(255, 255, 255, 0.06)'

// Team palette: team1 = blue/cyan, team2 = orange/red
const TEAM_COLOR: Record<TeamKey, string> = {
  1: CYAN,
  2: '#fb923c',
}
const TEAM_DIM: Record<TeamKey, string> = {
  1: CYAN_DIM,
  2: 'rgba(251, 146, 60, 0.12)',
}

const n = (v: number) => Math.round(v).toLocaleString()

export function LiveScoreboard({
  snapshot,
  changed,
  leaders,
}: {
  snapshot: LiveSnapshot
  changed: Set<string>
  leaders: LiveLeaders
}) {
  const renderTeam = (teamKey: TeamKey) => {
    const team = teamKey === 1 ? snapshot.team1 : snapshot.team2
    const color = TEAM_COLOR[teamKey]
    const dimBg = TEAM_DIM[teamKey]

    const sortedPlayers = Object.entries(team.players).sort(
      ([, a], [, b]) => b.eliminations - a.eliminations,
    )

    const headerCell: React.CSSProperties = {
      padding: '8px 10px',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: TEXT_DIM,
      textAlign: 'right',
      borderBottom: `1px solid ${BORDER}`,
      background: 'rgba(255,255,255,0.02)',
      whiteSpace: 'nowrap',
    }

    return (
      <div key={teamKey} style={{ marginBottom: '20px' }}>
        {/* Team label */}
        <div
          style={{
            padding: '8px 12px 6px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color,
            background: dimBg,
            borderLeft: `3px solid ${color}`,
          }}
        >
          {team.name}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr>
                <th style={{ ...headerCell, textAlign: 'left', width: '25%' }}>Player</th>
                <th style={{ ...headerCell, textAlign: 'left', width: '14%' }}>Hero</th>
                <th style={headerCell}>E</th>
                <th style={headerCell}>FB</th>
                <th style={headerCell}>D</th>
                <th style={headerCell}>Dmg</th>
                <th style={headerCell}>Heal</th>
                <th style={headerCell}>Ult</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map(([name, p]) => {
                const ck = (stat: string) => changed.has(`${teamKey}:${name}:${stat}`)
                const hasUlt = p.ultimatesEarned > p.ultimatesUsed

                const cell: React.CSSProperties = {
                  padding: '9px 10px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: TEXT_PRIMARY,
                  borderBottom: `1px solid ${BORDER}`,
                  transition: 'background 0.15s',
                }

                return (
                  <tr key={name} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {/* Player */}
                    <td
                      style={{
                        padding: '9px 10px',
                        fontWeight: 600,
                        color,
                        borderBottom: `1px solid ${BORDER}`,
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {name}
                    </td>

                    {/* Hero */}
                    <td
                      style={{
                        padding: '9px 10px',
                        color: TEXT_SECONDARY,
                        borderBottom: `1px solid ${BORDER}`,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '80px',
                      }}
                    >
                      {p.hero}
                    </td>

                    {/* Eliminations (E) */}
                    <td
                      key={`elims-${p.eliminations}`}
                      className={ck('eliminations') ? 'pug-live-flash' : undefined}
                      style={cell}
                    >
                      {p.eliminations}
                      {leaders.elims === name && (
                        <span style={{ marginLeft: '4px', color: '#facc15', fontSize: '10px' }}>★</span>
                      )}
                    </td>

                    {/* Final Blows (FB) */}
                    <td
                      key={`fb-${p.finalBlows}`}
                      className={ck('finalBlows') ? 'pug-live-flash' : undefined}
                      style={cell}
                    >
                      {p.finalBlows}
                    </td>

                    {/* Deaths (D) */}
                    <td
                      key={`deaths-${p.deaths}`}
                      className={ck('deaths') ? 'pug-live-flash' : undefined}
                      style={{ ...cell, color: p.deaths > 4 ? RED : TEXT_PRIMARY }}
                    >
                      {p.deaths}
                    </td>

                    {/* Hero Damage (Dmg) */}
                    <td
                      key={`dmg-${p.heroDamage}`}
                      className={ck('heroDamage') ? 'pug-live-flash' : undefined}
                      style={cell}
                    >
                      {n(p.heroDamage)}
                      {leaders.damage === name && (
                        <span style={{ marginLeft: '4px', color: '#facc15', fontSize: '10px' }}>★</span>
                      )}
                    </td>

                    {/* Healing (Heal) */}
                    <td
                      key={`heal-${p.healingDealt}`}
                      className={ck('healingDealt') ? 'pug-live-flash' : undefined}
                      style={cell}
                    >
                      {n(p.healingDealt)}
                      {leaders.healing === name && (
                        <span style={{ marginLeft: '4px', color: '#facc15', fontSize: '10px' }}>★</span>
                      )}
                    </td>

                    {/* Ult */}
                    <td
                      key={`ult-${p.ultimatesUsed}`}
                      className={ck('ultimatesUsed') ? 'pug-live-flash' : undefined}
                      style={{ ...cell, position: 'relative', whiteSpace: 'nowrap' }}
                    >
                      {p.ultimatesUsed}
                      {hasUlt && (
                        <span
                          title="Ult ready"
                          style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: GREEN,
                            marginLeft: '5px',
                            verticalAlign: 'middle',
                            boxShadow: `0 0 4px ${GREEN}`,
                          }}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="scrim-detail__map-table-card" style={{ marginBottom: '20px' }}>
      <div className="scrim-detail__map-table-header">Live Scoreboard</div>
      <div style={{ padding: '16px 16px 4px' }}>
        {renderTeam(1)}
        {renderTeam(2)}
      </div>
    </div>
  )
}
