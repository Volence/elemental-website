import type { PlayerLine, TeamKey } from './types'

const n = (v: number) => Math.round(v).toLocaleString()

function TeamTable({ team, players }: { team: TeamKey; players: PlayerLine[] }) {
  const rows = players.filter((p) => p.team === team)
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-1">Team {team}</h3>
      <table className="w-full text-sm">
        <thead className="text-gray-500 text-xs">
          <tr><th className="text-left">Player</th><th>E</th><th>D</th><th>A</th><th>Dmg</th><th>Heal</th><th>Blk</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.personId ?? p.name} className="border-t border-gray-800/60">
              <td className="text-left py-1 text-gray-200">{p.isCaptain ? '★ ' : ''}{p.name}</td>
              <td className="text-center">{p.eliminations}</td>
              <td className="text-center">{p.deaths}</td>
              <td className="text-center">{p.assists}</td>
              <td className="text-center">{n(p.heroDamage)}</td>
              <td className="text-center">{n(p.healing)}</td>
              <td className="text-center">{n(p.damageBlocked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Scoreboard({ players }: { players: PlayerLine[] }) {
  return (<div><TeamTable team={1} players={players} /><TeamTable team={2} players={players} /></div>)
}
