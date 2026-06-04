'use client'

import React, { useState } from 'react'
import type { PlayerRow, OverviewTeams } from './types'

// ── Color tokens (mirrored from ScrimMapDetail for byte-identical markup) ──
const CYAN = '#06b6d4'
const CYAN_DIM = 'rgba(6, 182, 212, 0.12)'
const GREEN = '#22c55e'
const GREEN_DIM = 'rgba(34, 197, 94, 0.08)'
const RED = '#ef4444'
const RED_DIM = 'rgba(239, 68, 68, 0.08)'
const AMBER = '#f59e0b'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'
const TEXT_DIM = '#52525b'
const PURPLE_DIM = 'rgba(139, 92, 246, 0.08)'

type SortKey = keyof PlayerRow
type SortDir = 'asc' | 'desc'

const COLUMN_DEFS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'hero', label: 'Hero', align: 'left' },
  { key: 'role', label: 'Role', align: 'left' },
  { key: 'timePlayed', label: 'Time Played', align: 'right' },
  { key: 'eliminations', label: 'Eliminations', align: 'right' },
  { key: 'finalBlows', label: 'Final Blows', align: 'right' },
  { key: 'assists', label: 'Assists', align: 'right' },
  { key: 'deaths', label: 'Deaths', align: 'right' },
  { key: 'kd', label: 'K/D', align: 'right' },
  { key: 'kad', label: 'KA/D', align: 'right' },
  { key: 'damage', label: 'Hero Damage Dealt', align: 'right' },
  { key: 'damageReceived', label: 'Damage Received', align: 'right' },
  { key: 'damageBlocked', label: 'Damage Mitigated', align: 'right' },
  { key: 'healingReceived', label: 'Healing Received', align: 'right' },
  { key: 'healing', label: 'Healing Dealt', align: 'right' },
]

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function sumStat(players: PlayerRow[], key: keyof PlayerRow): number {
  return players.reduce((acc, p) => acc + (p[key] as number), 0)
}

function TeamHeader({ name, color, bgColor, won }: { name: string; color: string; bgColor: string; won: boolean }) {
  return (
    <tr>
      <td colSpan={COLUMN_DEFS.length} style={{
        padding: '12px 14px 6px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color,
        background: bgColor,
        borderLeft: `3px solid ${color}`,
      }}>
        {name} {won && <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '6px', color: GREEN }}>WIN</span>}
      </td>
    </tr>
  )
}

function TeamTotalRow({ players, color }: { players: PlayerRow[]; color: string }) {
  // Derive dim colors dynamically from the passed-in team color
  const borderColor = `${color}26`
  const bgColor = `${color}0a`
  const cellStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'right',
    fontWeight: 700,
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    color,
  }
  const totalElims = sumStat(players, 'eliminations')
  const totalDeaths = sumStat(players, 'deaths')
  const totalAssists = sumStat(players, 'assists')
  return (
    <tr style={{ borderBottom: `2px solid ${borderColor}`, background: bgColor }}>
      <td style={{ ...cellStyle, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }} colSpan={3}>
        Team Total
      </td>
      <td style={cellStyle}></td>
      <td style={cellStyle}>{totalElims}</td>
      <td style={cellStyle}>{sumStat(players, 'finalBlows')}</td>
      <td style={cellStyle}>{totalAssists}</td>
      <td style={cellStyle}>{totalDeaths}</td>
      <td style={cellStyle}>{totalDeaths > 0 ? Math.round(totalElims / totalDeaths * 100) / 100 : totalElims}</td>
      <td style={cellStyle}>{totalDeaths > 0 ? Math.round((totalElims + totalAssists) / totalDeaths * 100) / 100 : totalElims + totalAssists}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'damage'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'damageReceived'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'damageBlocked'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'healingReceived'))}</td>
      <td style={cellStyle}>{formatNumber(sumStat(players, 'healing'))}</td>
    </tr>
  )
}

/** Single stat table row */
function StatRow({ player, selected, readOnly }: { player: PlayerRow; selected: boolean; readOnly: boolean }) {
  const timeStr = `${Math.floor(player.timePlayed / 60)}m ${Math.floor(player.timePlayed % 60).toString().padStart(2, '0')}s`
  const cell: React.CSSProperties = { padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  return (
    <tr
      onClick={!readOnly ? () => window.location.href = `/admin/scrim-player-detail?player=${encodeURIComponent(player.name)}` : undefined}
      style={{
        cursor: !readOnly ? 'pointer' : 'default',
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? PURPLE_DIM : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <td style={{ padding: '10px 12px', fontWeight: 600, color: CYAN }}>{player.name}</td>
      <td style={{ padding: '10px 12px', color: TEXT_SECONDARY }}>{player.hero}</td>
      <td style={{ padding: '10px 12px', color: TEXT_DIM, fontSize: '12px' }}>{player.role}</td>
      <td style={{ ...cell, color: TEXT_DIM }}>{timeStr}</td>
      <td style={cell}>{player.eliminations}</td>
      <td style={cell}>{player.finalBlows}</td>
      <td style={cell}>{player.assists}</td>
      <td style={cell}>{player.deaths}</td>
      <td style={{ ...cell, color: player.kd >= 2 ? GREEN : player.kd < 1 ? RED : TEXT_PRIMARY, fontWeight: 600 }}>{player.kd}</td>
      <td style={{ ...cell, color: player.kad >= 3 ? GREEN : player.kad < 1.5 ? RED : TEXT_PRIMARY, fontWeight: 600 }}>{player.kad}</td>
      <td style={cell}>{formatNumber(player.damage)}</td>
      <td style={cell}>{formatNumber(player.damageReceived)}</td>
      <td style={cell}>{formatNumber(player.damageBlocked)}</td>
      <td style={cell}>{formatNumber(player.healingReceived)}</td>
      <td style={cell}>{formatNumber(player.healing)}</td>
    </tr>
  )
}

export function PlayerStatsTable({
  teams, players, team1Won, team2Won, readOnly = true,
}: {
  teams: OverviewTeams
  players: PlayerRow[]
  team1Won: boolean
  team2Won: boolean
  readOnly?: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('team')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'team' || key === 'hero' ? 'asc' : 'desc')
    }
  }

  const isDual = teams.isDualTeam ?? false
  const TEAM1_COLOR = isDual ? CYAN : GREEN
  const TEAM1_DIM = isDual ? CYAN_DIM : GREEN_DIM
  const TEAM2_COLOR = isDual ? AMBER : RED
  const TEAM2_DIM = isDual ? 'rgba(245, 158, 11, 0.08)' : RED_DIM

  const sortedPlayers = [...players].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const team1Players = sortedPlayers.filter((p) => p.team === teams.team1)
  const team2Players = sortedPlayers.filter((p) => p.team === teams.team2)

  return (
    <div className="scrim-detail__map-table-card" style={{ marginBottom: '28px' }}>
      <div className="scrim-detail__map-table-header">
        Player Stats
      </div>
      <div className="scrim-detail__map-table-scroll">
        <table className="scrim-detail__map-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              {COLUMN_DEFS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`scrim-detail__map-th ${sortKey === col.key ? 'scrim-detail__map-th--sorted' : ''} ${col.align === 'right' ? 'scrim-detail__map-th--right' : ''}`}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Team 1 */}
            <TeamHeader name={teams.team1} color={TEAM1_COLOR} bgColor={TEAM1_DIM} won={team1Won} />
            {team1Players.map((p) => (
              <StatRow key={p.name + p.hero} player={p} selected={false} readOnly={readOnly} />
            ))}
            <TeamTotalRow players={team1Players} color={TEAM1_COLOR} />
            {/* Team 2 */}
            <TeamHeader name={teams.team2} color={TEAM2_COLOR} bgColor={TEAM2_DIM} won={team2Won} />
            {team2Players.map((p) => (
              <StatRow key={p.name + p.hero} player={p} selected={false} readOnly={readOnly} />
            ))}
            <TeamTotalRow players={team2Players} color={TEAM2_COLOR} />
          </tbody>
        </table>
      </div>
    </div>
  )
}
