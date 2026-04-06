'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Loader2, AlertCircle, X } from 'lucide-react'
import RangeFilter, { type RangeValue } from '@/components/RangeFilter'

type PlayerSummary = {
  name: string
  personId: number | null
  team: string
  payloadTeamId: number | null
  payloadTeamName: string | null
  mapsPlayed: number
  eliminations: number
  deaths: number
  damage: number
  healing: number
  finalBlows: number
  mostPlayedHero: string
  aliases: string[]
}

type SortKey = 'name' | 'team' | 'mostPlayedHero' | 'mapsPlayed' | 'eliminations' | 'deaths' | 'finalBlows' | 'damage' | 'healing'
type SortDir = 'asc' | 'desc'

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Player', align: 'left' },
  { key: 'team', label: 'Team', align: 'left' },
  { key: 'mostPlayedHero', label: 'Main Hero', align: 'left' },
  { key: 'mapsPlayed', label: 'Maps', align: 'right' },
  { key: 'eliminations', label: 'Elims', align: 'right' },
  { key: 'deaths', label: 'Deaths', align: 'right' },
  { key: 'finalBlows', label: 'FB', align: 'right' },
  { key: 'damage', label: 'Damage', align: 'right' },
  { key: 'healing', label: 'Healing', align: 'right' },
]

/**
 * Admin view — player directory with career stats, grouped by team.
 * Payload-linked teams get their own section at the top.
 * Opponent players (no payloadTeamId) appear below, searchable.
 */
export default function ScrimPlayerListView() {
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('mapsPlayed')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<RangeValue>('last20')

  useEffect(() => {
    fetch(`/api/player-stats?range=${range}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setPlayers(d.players)
      })
      .catch(() => setError('Failed to fetch player stats'))
      .finally(() => setLoading(false))
  }, [range])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'team' || key === 'mostPlayedHero' ? 'asc' : 'desc')
    }
  }

  const sortPlayers = (list: PlayerSummary[]) => {
    return [...list].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  // Split into Payload team players and other players
  const { teamSections, otherPlayers } = useMemo(() => {
    const teamMap = new Map<string, { teamId: number; players: PlayerSummary[] }>()
    const others: PlayerSummary[] = []

    for (const p of players) {
      if (p.payloadTeamId && p.payloadTeamName) {
        const existing = teamMap.get(p.payloadTeamName) ?? { teamId: p.payloadTeamId, players: [] }
        existing.players.push(p)
        teamMap.set(p.payloadTeamName, existing)
      } else {
        others.push(p)
      }
    }

    return {
      teamSections: [...teamMap.entries()].map(([name, data]) => ({
        name,
        teamId: data.teamId,
        players: data.players,
      })),
      otherPlayers: others,
    }
  }, [players])

  // Filter other players by search
  const filteredOthers = useMemo(() => {
    if (!search.trim()) return otherPlayers
    const q = search.toLowerCase()
    return otherPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.mostPlayedHero.toLowerCase().includes(q) ||
        p.aliases.some((a) => a.toLowerCase().includes(q))
    )
  }, [otherPlayers, search])

  if (loading) {
    return (
      <div className="scrim-players__loading">
        <div className="scrim-players__loading-icon">
          <Loader2 size={32} />
        </div>
        <div className="scrim-players__loading-text">Loading player stats…</div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="scrim-players__error">
        <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
        {error}
      </div>
    )
  }

  const navigateToPlayer = (p: PlayerSummary) => {
    const url = p.personId
      ? `/admin/scrim-player-detail?personId=${p.personId}`
      : `/admin/scrim-player-detail?player=${encodeURIComponent(p.name)}`
    window.location.href = url
  }

  const renderTableHead = (showTeam = true) => (
    <thead>
      <tr>
        {COLUMNS.filter(col => showTeam || col.key !== 'team').map((col) => (
          <th
            key={col.key}
            onClick={() => handleSort(col.key)}
            className={`scrim-players__th ${sortKey === col.key ? 'scrim-players__th--sorted' : ''} ${col.align === 'right' ? 'scrim-players__th--right' : ''}`}
          >
            {col.label}
            {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
          </th>
        ))}
      </tr>
    </thead>
  )

  const renderPlayerRow = (p: PlayerSummary, showTeam = true) => (
    <tr
      key={p.personId ? `pid-${p.personId}` : p.name}
      onClick={() => navigateToPlayer(p)}
      className="scrim-players__row"
    >
      <td className="scrim-players__td scrim-players__td--name">{p.name}</td>
      {showTeam && <td className="scrim-players__td scrim-players__td--secondary">{p.team}</td>}
      <td className="scrim-players__td scrim-players__td--secondary">{p.mostPlayedHero}</td>
      <td className="scrim-players__td scrim-players__td--maps">{p.mapsPlayed}</td>
      <td className="scrim-players__td scrim-players__td--stat">{p.eliminations}</td>
      <td className="scrim-players__td scrim-players__td--stat">{p.deaths}</td>
      <td className="scrim-players__td scrim-players__td--stat">{p.finalBlows}</td>
      <td className="scrim-players__td scrim-players__td--stat">{formatNumber(p.damage)}</td>
      <td className="scrim-players__td scrim-players__td--stat">{formatNumber(p.healing)}</td>
    </tr>
  )

  return (
    <div className="scrim-players">
      {/* Header */}
      <div className="scrim-players__header">
        <div className="scrim-players__header-row">
          <div>
            <div className="scrim-players__title-row">
              <h1 className="scrim-players__title">Player Stats</h1>
              <span className="scrim-players__count">
                {players.length} player{players.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="scrim-players__subtitle">
              Aggregated career stats across all scrims
            </p>
          </div>
          <RangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Team Sections */}
      {teamSections.map((section) => (
        <div key={section.teamId} className="scrim-players__team-section">
          <div className="scrim-players__team-header">
            <h2 className="scrim-players__team-name">
              <a
                href={`/admin/scrim-team?teamId=${section.teamId}`}
                className="scrim-players__team-link"
              >
                {section.name}
              </a>
            </h2>
            <span className="scrim-players__badge scrim-players__badge--cyan">
              {section.players.length} player{section.players.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="scrim-players__table-card">
            <table className="scrim-players__table">
              {renderTableHead(false)}
              <tbody>
                {sortPlayers(section.players).map(p => renderPlayerRow(p, false))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Other Players (Opponents) */}
      <div className="scrim-players__team-section">
        <div className="scrim-players__team-header">
          <h2 className="scrim-players__team-name" style={{ color: 'var(--admin-text-primary, #f0f0f5)' }}>
            Other Players
          </h2>
          <span className="scrim-players__badge scrim-players__badge--muted">
            {filteredOthers.length} of {otherPlayers.length} player{otherPlayers.length !== 1 ? 's' : ''}
          </span>
          {/* Search bar */}
          <div className="scrim-players__search-wrap">
            <input
              type="text"
              placeholder="Search players, teams, heroes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`scrim-players__search-input ${search ? 'scrim-players__search-input--has-value' : ''}`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="scrim-players__search-clear"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="scrim-players__table-card">
          <table className="scrim-players__table">
            {renderTableHead()}
            <tbody>
              {filteredOthers.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="scrim-players__empty">
                    {search ? `No players matching "${search}"` : 'No opponent data yet'}
                  </td>
                </tr>
              ) : (
                sortPlayers(filteredOthers).map(p => renderPlayerRow(p))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
