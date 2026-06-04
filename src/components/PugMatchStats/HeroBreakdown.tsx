import type { PlayerLine, HeroSwap } from './types'

const mins = (s: number) => `${Math.round(s / 60)}m`

export function HeroBreakdown({ players, heroSwaps }: { players: PlayerLine[]; heroSwaps: HeroSwap[] }) {
  return (
    <div className="space-y-2">
      {players.map((p) => (
        <div key={p.personId ?? p.name} className="rounded-lg border border-gray-800 p-2">
          <div className="text-sm text-gray-200 mb-1">Team {p.team} · {p.name}</div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-400">
            {p.heroes.map((h) => (
              <span key={h.hero} className="px-2 py-0.5 rounded bg-gray-800/60">
                {h.hero} · {mins(h.timePlayedSec)} · {h.eliminations}E/{h.deaths}D
              </span>
            ))}
          </div>
        </div>
      ))}
      {heroSwaps.length > 0 && (
        <div className="text-xs text-gray-500 mt-2">
          {heroSwaps.length} hero swap{heroSwaps.length === 1 ? '' : 's'} during the match.
        </div>
      )}
    </div>
  )
}
