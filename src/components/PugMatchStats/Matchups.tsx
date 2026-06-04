import type { RoleMatchup, PlayerLine } from './types'

// Color tokens -- mirrored from ScrimMapDetail / PlayerStatsTable
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'
const BORDER = 'rgba(255, 255, 255, 0.06)'

const stat = (p: PlayerLine | null) =>
  p ? `${p.eliminations}E / ${p.deaths}D · ${Math.round(p.heroDamage).toLocaleString()} dmg` : '—'

export function Matchups({ matchups, unpaired }: { matchups: RoleMatchup[]; unpaired: PlayerLine[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {matchups.map((m, i) => (
        <div
          key={`${m.role}-${i}`}
          className="scrim-detail__card"
          style={{ padding: '14px 18px' }}
        >
          {/* Role label */}
          <div className="scrim-detail__label" style={{ marginBottom: '10px' }}>
            {m.role}
          </div>

          {/* Two players side by side */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'start',
              gap: '12px',
            }}
          >
            {/* Team 1 player -- right-aligned */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: '3px' }}>
                {m.team1?.name ?? '—'}
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM }}>{stat(m.team1)}</div>
            </div>

            {/* Center divider */}
            <div
              style={{
                width: '1px',
                alignSelf: 'stretch',
                background: BORDER,
                margin: '2px 4px',
              }}
            />

            {/* Team 2 player -- left-aligned */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: '3px' }}>
                {m.team2?.name ?? '—'}
              </div>
              <div style={{ fontSize: '11px', color: TEXT_DIM }}>{stat(m.team2)}</div>
            </div>
          </div>
        </div>
      ))}

      {unpaired.length > 0 && (
        <div style={{ fontSize: '11px', color: TEXT_SECONDARY, marginTop: '4px', paddingLeft: '4px' }}>
          Unpaired: {unpaired.map((p) => p.name).join(', ')}
        </div>
      )}
    </div>
  )
}
