// Color tokens -- mirrored from ScrimMapDetail / PlayerStatsTable
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'
const BORDER = 'rgba(255, 255, 255, 0.06)'

const fmtDuration = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`

export function MatchSummary({
  lobbyNumber, mapName, durationSec, team1Score, team2Score, result, standout,
}: {
  lobbyNumber: number; mapName: string; durationSec: number
  team1Score: number; team2Score: number
  result: 'team1' | 'team2' | 'draw'
  standout: { name: string; eliminations: number } | null
}) {
  const t1Win = result === 'team1'
  const t2Win = result === 'team2'
  const accentColor = CYAN

  return (
    <div
      className="scrim-detail__summary-card"
      style={{ borderTop: `2px solid ${accentColor}`, marginBottom: '20px' }}
    >
      <div
        className="scrim-detail__summary-glow"
        style={{ background: `radial-gradient(circle at 80% 0%, ${accentColor}0a 0%, transparent 70%)` }}
      />

      {/* Header row: match identity + standout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div
          className="scrim-detail__summary-label"
          style={{ margin: 0, color: TEXT_SECONDARY }}
        >
          PUG #{lobbyNumber} &middot; {mapName} &middot; {fmtDuration(durationSec)}
        </div>
        {standout && (
          <div style={{ fontSize: '12px', color: CYAN, fontWeight: 600 }}>
            Standout: {standout.name} ({standout.eliminations} elims)
          </div>
        )}
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        {/* Team 1 */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '11px',
              color: TEXT_SECONDARY,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
              marginBottom: '4px',
              borderBottom: `1px solid ${CYAN}44`,
              paddingBottom: '4px',
            }}
          >
            <span style={{ color: t1Win ? GREEN : t2Win ? TEXT_SECONDARY : TEXT_PRIMARY, fontWeight: t1Win ? 600 : 400 }}>
              Team 1
            </span>
          </div>
          <div
            className="scrim-detail__summary-value"
            style={{ color: t1Win ? GREEN : TEXT_PRIMARY, textShadow: t1Win ? `0 0 16px ${GREEN}44` : undefined }}
          >
            {team1Score}
          </div>
        </div>

        {/* Divider */}
        <div style={{ fontSize: '18px', color: TEXT_DIM, fontWeight: 700, padding: '0 8px' }}>vs</div>

        {/* Team 2 */}
        <div style={{ textAlign: 'left' }}>
          <div
            style={{
              fontSize: '11px',
              color: TEXT_SECONDARY,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
              marginBottom: '4px',
              borderBottom: `1px solid ${CYAN}44`,
              paddingBottom: '4px',
            }}
          >
            <span style={{ color: t2Win ? GREEN : t1Win ? TEXT_SECONDARY : TEXT_PRIMARY, fontWeight: t2Win ? 600 : 400 }}>
              Team 2
            </span>
          </div>
          <div
            className="scrim-detail__summary-value"
            style={{ color: t2Win ? GREEN : TEXT_PRIMARY, textShadow: t2Win ? `0 0 16px ${GREEN}44` : undefined }}
          >
            {team2Score}
          </div>
        </div>
      </div>
    </div>
  )
}
