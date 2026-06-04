import type { KillEvent, UltEvent } from './types'

const ts = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

type Row = { t: number; text: string; team: 1 | 2 }

export function MatchTimeline({ kills, ults }: { kills: KillEvent[]; ults: UltEvent[] }) {
  const rows: Row[] = [
    ...kills.map((k) => ({ t: k.matchTimeSec, team: k.attackerTeam, text: `${k.attacker} ${k.isEnvironmental ? 'env-killed' : 'eliminated'} ${k.victim}${k.isCrit ? ' (crit)' : ''}` })),
    ...ults.map((u) => ({ t: u.matchTimeSec, team: u.team, text: `${u.player} ult ready (${u.hero})` })),
  ].sort((a, b) => a.t - b.t)
  return (
    <div className="space-y-0.5 text-xs font-mono max-h-[28rem] overflow-y-auto">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gray-600 w-10">{ts(r.t)}</span>
          <span className={r.team === 1 ? 'text-blue-300' : 'text-red-300'}>{r.text}</span>
        </div>
      ))}
    </div>
  )
}
