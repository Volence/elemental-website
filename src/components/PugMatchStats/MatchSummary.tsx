import type { MatchSummaryData } from './types'

const fmtDuration = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`

export function MatchSummary({ s }: { s: MatchSummaryData }) {
  const t1Win = s.result === 'team1', t2Win = s.result === 'team2'
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">PUG #{s.lobbyNumber} · {s.mapName} · {fmtDuration(s.durationSec)}</div>
        {s.standout && <div className="text-sm text-cyan-300">Standout: {s.standout.name} ({s.standout.eliminations} elims)</div>}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-2xl font-bold">
        <span className={t1Win ? 'text-green-400' : 'text-gray-300'}>Team 1 · {s.team1Score}</span>
        <span className="text-gray-600">vs</span>
        <span className={t2Win ? 'text-green-400' : 'text-gray-300'}>{s.team2Score} · Team 2</span>
      </div>
    </div>
  )
}
