'use client'

import React, { useState, useEffect, useMemo } from 'react'
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

// ── Design tokens (Clean Glow) ──
const CYAN = '#06b6d4'
const GREEN = '#22c55e'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const BG = '#0a0e1a'
const BG_CARD = 'rgba(255, 255, 255, 0.03)'
const BORDER = 'rgba(255, 255, 255, 0.06)'
const TEXT_PRIMARY = '#f0f0f5'
const TEXT_SECONDARY = '#71717a'

const CARD_STYLE: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
  overflow: 'hidden',
}

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
      <div style={{ padding: '60px', textAlign: 'center', color: TEXT_SECONDARY }}>
        Loading player stats…
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ color: RED }}>❌ {error}</p>
      </div>
    )
  }

  const navigateToPlayer = (p: PlayerSummary) => {
    const url = p.personId
      ? `/admin/scrim-player-detail?personId=${p.personId}`
      : `/admin/scrim-player-detail?player=${encodeURIComponent(p.name)}`
    window.location.href = url
  }

  const renderTableHead = () => (
    <thead>
      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
        {COLUMNS.map((col) => (
          <th
            key={col.key}
            onClick={() => handleSort(col.key)}
            style={{
              padding: '14px 16px',
              textAlign: col.align,
              cursor: 'pointer',
              fontWeight: sortKey === col.key ? 700 : 500,
              color: sortKey === col.key ? CYAN : TEXT_SECONDARY,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'color 0.15s',
            }}
          >
            {col.label}
            {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
          </th>
        ))}
      </tr>
    </thead>
  )

  const renderPlayerRow = (p: PlayerSummary) => (
    <tr
      key={p.personId ? `pid-${p.personId}` : p.name}
      onClick={() => navigateToPlayer(p)}
      style={{
        cursor: 'pointer',
        borderBottom: `1px solid ${BORDER}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '12px 16px', fontWeight: 700, color: TEXT_PRIMARY }}>{p.name}</td>
      <td style={{ padding: '12px 16px', color: TEXT_SECONDARY }}>{p.team}</td>
      <td style={{ padding: '12px 16px', color: TEXT_SECONDARY }}>{p.mostPlayedHero}</td>
      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: CYAN, fontVariantNumeric: 'tabular-nums' }}>{p.mapsPlayed}</td>
      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.eliminations}</td>
      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.deaths}</td>
      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.finalBlows}</td>
      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(p.damage)}</td>
      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(p.healing)}</td>
    </tr>
  )

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif", background: BG, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: TEXT_PRIMARY, letterSpacing: '-0.5px' }}>
                Player Stats
              </h1>
              <span style={{ fontSize: '13px', color: TEXT_SECONDARY }}>
                {players.length} player{players.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p style={{ color: TEXT_SECONDARY, fontSize: '14px', marginTop: '6px' }}>
              Aggregated career stats across all scrims
            </p>
          </div>
          <RangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Team Sections */}
      {teamSections.map((section) => (
        <div key={section.teamId} style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              <a
                href={`/admin/scrim-team?teamId=${section.teamId}`}
                style={{ color: TEXT_PRIMARY, textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = CYAN)}
                onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_PRIMARY)}
              >
                {section.name}
              </a>
            </h2>
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(6, 182, 212, 0.15)',
              color: CYAN,
              border: '1px solid rgba(6, 182, 212, 0.25)',
            }}>
              {section.players.length} player{section.players.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={CARD_STYLE}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              {renderTableHead()}
              <tbody>
                {sortPlayers(section.players).map(renderPlayerRow)}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Other Players (Opponents) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: TEXT_PRIMARY }}>
            Other Players
          </h2>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(113, 113, 122, 0.15)',
            color: TEXT_SECONDARY,
            border: '1px solid rgba(113, 113, 122, 0.25)',
          }}>
            {filteredOthers.length} of {otherPlayers.length} player{otherPlayers.length !== 1 ? 's' : ''}
          </span>
          {/* Search bar */}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search players, teams, heroes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '8px 14px',
                paddingRight: search ? '32px' : '14px',
                borderRadius: '8px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255, 255, 255, 0.04)',
                color: TEXT_PRIMARY,
                fontSize: '13px',
                outline: 'none',
                width: '240px',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(6, 182, 212, 0.4)')}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: TEXT_SECONDARY,
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '2px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={CARD_STYLE}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            {renderTableHead()}
            <tbody>
              {filteredOthers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: TEXT_SECONDARY }}>
                    {search ? `No players matching "${search}"` : 'No opponent data yet'}
                  </td>
                </tr>
              ) : (
                sortPlayers(filteredOthers).map(renderPlayerRow)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
