'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AdminPagination,
  AdminTable,
  Badge,
  ErrorState,
  SearchInput,
  EMPTY,
  formatDateTime,
  formatNumber,
} from '@/admin-kit'
import type { AdminTableColumn, BadgeTone } from '@/admin-kit'
import type { MatchHistoryPlayer, MatchHistoryRow, MatchResult } from '@/pug/matchHistory'

const PAGE_SIZE = 25

const RESULT_BADGE: Record<MatchResult, { label: string; tone: BadgeTone }> = {
  team1: { label: 'Team 1 win', tone: 'info' },
  team2: { label: 'Team 2 win', tone: 'accent' },
  draw: { label: 'Draw', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  pending: { label: 'Unresolved', tone: 'warning' },
}

const ROLE_SHORT: Record<string, string> = {
  tank: 'Tank',
  flex_dps: 'FDPS',
  hitscan_dps: 'HDPS',
  flex_support: 'FSup',
  main_support: 'MSup',
}

const TIERS = ['all', 'open', 'invite'] as const
const STATUSES = [
  { value: 'finished', label: 'All finished' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'cancelled', label: 'Cancelled' },
]
const REGIONS = ['all', 'na', 'emea', 'pacific'] as const

type Season = { id: number; name: string; tier: string }

function TeamCell({ players }: { players: MatchHistoryPlayer[] }) {
  if (players.length === 0) return <span className="pug-list__muted">{EMPTY}</span>
  return (
    <span className="pug-matches__team">
      {players.map((p) => (
        <span key={p.id} title={p.role ? ROLE_SHORT[p.role] ?? p.role : undefined}>
          {p.name}
          {p.isCaptain && <span className="pug-matches__captain" aria-label="captain"> (C)</span>}
        </span>
      ))}
    </span>
  )
}

/**
 * Match history for the PUG dashboard. Reads finished lobbies from Prisma via
 * /api/pug/admin/matches; the old Payload `pug-matches` collection was never
 * written, which is why this tab used to be empty.
 */
export function PugMatchesListView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tier = searchParams?.get('tier') ?? 'all'
  const status = searchParams?.get('status') ?? 'finished'
  const season = searchParams?.get('season') ?? 'all'
  const region = searchParams?.get('region') ?? 'all'
  const q = searchParams?.get('q') ?? ''
  const page = Math.max(1, parseInt(searchParams?.get('page') ?? '1', 10) || 1)

  // One URL write per change, so a filter change and the page reset never race.
  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )
  const setFilter = (key: string, defaultValue: string) => (value: string) =>
    setParams({ [key]: value === defaultValue ? null : value, page: null })

  const [rows, setRows] = useState<MatchHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pug-seasons?limit=50&depth=0&sort=-startDate', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((d) => setSeasons((d.docs ?? []).map((s: any) => ({ id: s.id, name: s.name, tier: s.tier }))))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), status })
    if (tier !== 'all') params.set('tier', tier)
    if (season !== 'all') params.set('season', season)
    if (region !== 'all') params.set('region', region)
    if (q.trim()) params.set('q', q.trim())
    try {
      const res = await fetch(`/api/pug/admin/matches?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load matches (HTTP ${res.status})`)
      const data = await res.json()
      setRows(data.rows ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load matches')
    } finally {
      setLoading(false)
    }
  }, [page, status, tier, season, region, q])

  useEffect(() => { void load() }, [load])

  const columns: AdminTableColumn<MatchHistoryRow>[] = [
    {
      key: 'lobby',
      header: 'Lobby',
      render: (m) => (
        <span className="pug-matches__lobby">
          <strong>#{m.lobbyNumber}</strong>
          <span className="pug-list__badges">
            <Badge tone={m.tier === 'invite' ? 'accent' : 'info'} uppercase size="sm">{m.tier}</Badge>
            {m.region && <Badge uppercase size="sm">{m.region}</Badge>}
          </span>
        </span>
      ),
    },
    { key: 'playedAt', header: 'Played', render: (m) => formatDateTime(m.playedAt) },
    {
      key: 'result',
      header: 'Result',
      render: (m) => {
        const badge = RESULT_BADGE[m.result]
        return (
          <span className="pug-list__badges">
            <Badge tone={badge.tone} dot>{badge.label}</Badge>
            {m.status === 'DISPUTED' && <Badge tone="danger" uppercase size="sm">Disputed</Badge>}
            {m.result !== 'cancelled' && m.result !== 'pending' && !m.ratingChanged && (
              <Badge tone="warning" size="sm" title="No rating changes were recorded for this match">No rating</Badge>
            )}
          </span>
        )
      },
    },
    { key: 'map', header: 'Map', hideOnMobile: true, render: (m) => m.mapName ?? <span className="pug-list__muted">{EMPTY}</span> },
    { key: 'team1', header: 'Team 1', hideOnMobile: true, render: (m) => <TeamCell players={m.team1} /> },
    { key: 'team2', header: 'Team 2', hideOnMobile: true, render: (m) => <TeamCell players={m.team2} /> },
    { key: 'season', header: 'Season', hideOnMobile: true, render: (m) => m.seasonName ?? <span className="pug-list__muted">{EMPTY}</span> },
    {
      key: 'links',
      header: '',
      align: 'right',
      render: (m) => (
        <span className="pug-matches__links">
          <a href={`/pugs/lobby/${m.id}`} target="_blank" rel="noopener noreferrer">Lobby</a>
          {m.status === 'COMPLETED' && (
            <a href={`/pugs/lobby/${m.id}/stats`} target="_blank" rel="noopener noreferrer">Stats</a>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="ps-wrap pug-matches">
      <div className="ps-header">
        <h2 className="ps-title">
          Matches <span className="pug-list__count">({formatNumber(total)})</span>
        </h2>
      </div>

      <div className="pug-list__toolbar">
        <SearchInput
          value={q}
          onChange={setFilter('q', '')}
          placeholder="Lobby number"
          aria-label="Search by lobby number"
          size="sm"
        />
        <div className="ps-tabs" role="group" aria-label="Tier">
          {TIERS.map((t) => (
            <button key={t} type="button" className={`ps-tab${tier === t ? ' ps-tab-active' : ''}`} onClick={() => setFilter('tier', 'all')(t)} aria-pressed={tier === t}>
              {t === 'all' ? 'All tiers' : t === 'open' ? 'Open' : 'Invite'}
            </button>
          ))}
        </div>
        <div className="ps-tabs" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button key={s.value} type="button" className={`ps-tab${status === s.value ? ' ps-tab-active' : ''}`} onClick={() => setFilter('status', 'finished')(s.value)} aria-pressed={status === s.value}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="ps-tabs" role="group" aria-label="Region">
          {REGIONS.map((r) => (
            <button key={r} type="button" className={`ps-tab${region === r ? ' ps-tab-active' : ''}`} onClick={() => setFilter('region', 'all')(r)} aria-pressed={region === r}>
              {r === 'all' ? 'All regions' : r.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="pug-list__select">
          <span className="sr-only">Season</span>
          <select className="ps-select" value={season} onChange={(e) => setFilter('season', 'all')(e.target.value)} aria-label="Season">
            <option value="all">All seasons</option>
            {seasons
              .filter((s) => tier === 'all' || s.tier === tier)
              .map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
          </select>
        </label>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <AdminTable
            aria-label="PUG match history"
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            loading={loading}
            rowHref={(m) => `/pugs/lobby/${m.id}`}
            emptyTitle={q || tier !== 'all' || season !== 'all' || region !== 'all' || status !== 'finished' ? 'No matches match these filters' : 'No finished matches yet'}
            emptyHint="Matches appear here once a lobby completes, is disputed, or is cancelled."
          />
          {total > PAGE_SIZE && (
            <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={(p) => setParams({ page: p === 1 ? null : String(p) })} />
          )}
        </>
      )}
    </div>
  )
}
