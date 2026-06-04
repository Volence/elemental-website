import type { RoleMatchup, PlayerLine } from './types'

const stat = (p: PlayerLine | null) => p ? `${p.eliminations}E / ${p.deaths}D · ${Math.round(p.heroDamage).toLocaleString()} dmg` : '—'

export function Matchups({ matchups, unpaired }: { matchups: RoleMatchup[]; unpaired: PlayerLine[] }) {
  return (
    <div className="space-y-2">
      {matchups.map((m, i) => (
        <div key={`${m.role}-${i}`} className="rounded-lg border border-gray-800 p-2">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{m.role}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-right text-gray-200">{m.team1?.name ?? '—'}<div className="text-xs text-gray-500">{stat(m.team1)}</div></div>
            <div className="text-left text-gray-200">{m.team2?.name ?? '—'}<div className="text-xs text-gray-500">{stat(m.team2)}</div></div>
          </div>
        </div>
      ))}
      {unpaired.length > 0 && (
        <div className="text-xs text-gray-500">Unpaired: {unpaired.map((p) => p.name).join(', ')}</div>
      )}
    </div>
  )
}
