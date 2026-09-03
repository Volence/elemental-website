'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react'
import {
  AdminTable,
  Badge,
  ErrorState,
  EMPTY,
  formatNumber,
  formatPercent,
  formatRecord,
} from '@/admin-kit'
import type { AdminTableColumn } from '@/admin-kit'
import { pugTabHref } from '@/components/PugDashboard/tabs'

type LeaderboardEntry = {
  id: number
  player: { id: number; name?: string | null; email?: string | null; user?: { name?: string } | number } | number
  season: { id: number; name?: string } | number
  tier: string
  region?: string | null
  rating: number
  ratingDeviation: number
  volatility: number
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
}

type Season = { id: number; name: string; tier: string; active?: boolean }

function playerId(entry: LeaderboardEntry): number {
  return typeof entry.player === 'object' ? entry.player.id : entry.player
}

function getPlayerName(entry: LeaderboardEntry): string {
  if (typeof entry.player === 'object') {
    const p = entry.player as any
    if (p.name) return p.name
    if (typeof p.user === 'object' && p.user?.name) return p.user.name
    if (p.email) return p.email
    return `Player #${p.id}`
  }
  return `Player #${entry.player}`
}

function getSeasonName(entry: LeaderboardEntry): string {
  if (typeof entry.season === 'object') return (entry.season as any).name ?? `Season #${(entry.season as any).id}`
  return `Season #${entry.season}`
}

const TIERS = ['open', 'invite'] as const
const REGIONS = ['all', 'na', 'emea', 'pacific'] as const

// ---- List View ----

/**
 * Ratings for one season at a time. The old version listed every entry of every
 * season and tier in one pile; this one mirrors the public leaderboard's filters
 * and adds the players who registered but have not played yet.
 */
export function PugLeaderboardListView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tier = searchParams?.get('tier') === 'invite' ? 'invite' : 'open'
  const seasonParam = searchParams?.get('season') ?? ''
  const region = searchParams?.get('region') ?? 'all'
  const showIdle = searchParams?.get('idle') === '1'

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

  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonsLoaded, setSeasonsLoaded] = useState(false)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pug-seasons?limit=50&depth=0&sort=-startDate', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((d) => setSeasons((d.docs ?? []).map((s: any) => ({ id: s.id, name: s.name, tier: s.tier, active: s.active }))))
      .catch(() => {})
      .finally(() => setSeasonsLoaded(true))
  }, [])

  const tierSeasons = useMemo(() => seasons.filter((s) => s.tier === tier), [seasons, tier])
  // Selected season: the URL, else the active season for this tier, else the newest.
  const seasonId = useMemo(() => {
    const fromUrl = parseInt(seasonParam, 10)
    if (fromUrl && tierSeasons.some((s) => s.id === fromUrl)) return fromUrl
    return (tierSeasons.find((s) => s.active) ?? tierSeasons[0])?.id ?? null
  }, [seasonParam, tierSeasons])

  const load = useCallback(async () => {
    if (!seasonsLoaded) return
    if (!seasonId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ tier, seasonId: String(seasonId) })
    if (tier === 'invite' && region !== 'all') params.set('region', region)
    try {
      const res = await fetch(`/api/pug/leaderboard?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load leaderboard (HTTP ${res.status})`)
      const data = await res.json()
      setEntries(data.entries ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [seasonsLoaded, seasonId, tier, region])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const rows = showIdle ? entries : entries.filter((e) => (e.gamesPlayed ?? 0) > 0)
    return [...rows].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  }, [entries, showIdle])
  const idleCount = entries.length - entries.filter((e) => (e.gamesPlayed ?? 0) > 0).length

  const columns: AdminTableColumn<LeaderboardEntry>[] = [
    { key: 'rank', header: '#', width: 48, align: 'right', render: (_e, i) => formatNumber(i + 1) },
    {
      key: 'player',
      header: 'Player',
      render: (e) => (
        <span className="pug-list__badges">
          <span>{getPlayerName(e)}</span>
          {tier === 'invite' && e.region && <Badge uppercase size="sm">{e.region}</Badge>}
        </span>
      ),
    },
    { key: 'rating', header: 'Rating', align: 'right', render: (e) => <strong>{formatNumber(Math.round(e.rating ?? 0))}</strong> },
    {
      key: 'rd',
      header: 'RD',
      align: 'right',
      hideOnMobile: true,
      render: (e) => <span title="Rating deviation: lower means more settled">{formatNumber(Math.round(e.ratingDeviation ?? 0))}</span>,
    },
    { key: 'record', header: 'W-L-D', align: 'right', render: (e) => formatRecord({ w: e.wins, l: e.losses, d: e.draws }) },
    { key: 'games', header: 'Games', align: 'right', hideOnMobile: true, render: (e) => formatNumber(e.gamesPlayed ?? 0) },
    {
      key: 'winrate',
      header: 'Win %',
      align: 'right',
      hideOnMobile: true,
      render: (e) => ((e.gamesPlayed ?? 0) > 0 ? formatPercent((e.wins ?? 0) / e.gamesPlayed) : <span className="pug-list__muted">{EMPTY}</span>),
    },
    {
      key: 'links',
      header: '',
      align: 'right',
      render: (e) => (
        <span className="pug-matches__links">
          <a href={`/pugs/profile/${playerId(e)}`} target="_blank" rel="noopener noreferrer">Profile</a>
        </span>
      ),
    },
  ]

  const seasonName = tierSeasons.find((s) => s.id === seasonId)?.name

  return (
    <div className="ps-wrap pug-leaderboard">
      <div className="ps-header">
        <h2 className="ps-title">
          Leaderboard {seasonName && <span className="pug-list__count">{seasonName}</span>}
        </h2>
      </div>

      <div className="pug-list__toolbar">
        <div className="ps-tabs" role="group" aria-label="Tier">
          {TIERS.map((t) => (
            <button key={t} type="button" className={`ps-tab${tier === t ? ' ps-tab-active' : ''}`} onClick={() => setParams({ tier: t === 'open' ? null : t, season: null, region: null })} aria-pressed={tier === t}>
              {t === 'open' ? 'Open' : 'Invite'}
            </button>
          ))}
        </div>
        {tier === 'invite' && (
          <div className="ps-tabs" role="group" aria-label="Region">
            {REGIONS.map((r) => (
              <button key={r} type="button" className={`ps-tab${region === r ? ' ps-tab-active' : ''}`} onClick={() => setParams({ region: r === 'all' ? null : r })} aria-pressed={region === r}>
                {r === 'all' ? 'All regions' : r.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <select
          className="ps-select"
          value={seasonId ?? ''}
          onChange={(e) => setParams({ season: e.target.value || null })}
          aria-label="Season"
          disabled={tierSeasons.length === 0}
        >
          {tierSeasons.length === 0 && <option value="">No seasons for this tier</option>}
          {tierSeasons.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}{s.active ? ' (active)' : ''}
            </option>
          ))}
        </select>
        <label className="ps-check-label pug-list__check">
          <input type="checkbox" checked={showIdle} onChange={(e) => setParams({ idle: e.target.checked ? '1' : null })} />
          Show players without games{idleCount > 0 ? ` (${idleCount})` : ''}
        </label>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <AdminTable
          aria-label="PUG leaderboard"
          columns={columns}
          rows={visible}
          rowKey={(e) => e.id}
          loading={loading}
          rowHref={(e) => `/admin/edit-pug-leaderboard?id=${e.id}`}
          emptyTitle={!seasonId ? 'No season to show' : entries.length === 0 ? 'No ratings for this season yet' : 'Nobody has played yet'}
          emptyHint={!seasonId ? 'Create a season on the Seasons tab first.' : 'Entries appear after a player finishes a match. Turn on "Show players without games" to see registrations.'}
        />
      )}
    </div>
  )
}

// ---- Edit View ----

export function PugLeaderboardEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState({
    playerName: '',
    seasonName: '',
    tier: '',
    region: '',
    rating: 1500,
    ratingDeviation: 350,
    volatility: 0.06,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
  })

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/pug-leaderboard/${id}?depth=2`)
      .then((r) => r.json())
      .then((data: LeaderboardEntry) => {
        setForm({
          playerName: getPlayerName(data),
          seasonName: getSeasonName(data),
          tier: data.tier,
          region: data.region ?? '',
          rating: data.rating,
          ratingDeviation: data.ratingDeviation,
          volatility: data.volatility,
          wins: data.wins,
          losses: data.losses,
          draws: data.draws,
          gamesPlayed: data.gamesPlayed,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  function setField(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaveStatus('idle')
  }

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const res = await fetch(`/api/pug-leaderboard/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: form.rating,
          ratingDeviation: form.ratingDeviation,
          volatility: form.volatility,
          wins: form.wins,
          losses: form.losses,
          draws: form.draws,
          gamesPlayed: form.gamesPlayed,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveStatus('error')
        setSaveMsg(data?.errors?.[0]?.message ?? data?.message ?? 'Save failed')
        return
      }
      setSaveStatus('saved')
      setSaveMsg('Saved')
    } catch (e: any) {
      setSaveStatus('error')
      setSaveMsg(e.message ?? 'Unexpected error')
    }
  }

  if (loading) {
    return (
      <div className="ps-wrap">
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="ps-wrap">

      <button className="ps-back" onClick={() => router.push(pugTabHref('leaderboard'))}>
        <ArrowLeft size={14} /> Back to Leaderboard
      </button>

      <p className="ps-form-title">{form.playerName} - {form.seasonName}</p>

      {/* Player & Season (read-only) */}
      <div className="ps-section">
        <p className="ps-section-title">Player & Season</p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Player</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.playerName}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Season</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.seasonName}</div>
          </div>
        </div>
        <div className="ps-row ps-row-2">
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Tier</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.tier}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Region</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.region ? form.region.toUpperCase() : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="ps-section">
        <p className="ps-section-title">Rating</p>
        <div className="ps-row ps-row-3">
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Rating</label>
            <input type="number" className="ps-input" value={form.rating} onChange={(e) => setField('rating', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Deviation</label>
            <input type="number" className="ps-input" value={form.ratingDeviation} onChange={(e) => setField('ratingDeviation', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Volatility</label>
            <input type="number" step="0.001" className="ps-input" value={form.volatility} onChange={(e) => setField('volatility', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Record */}
      <div className="ps-section">
        <p className="ps-section-title">Record</p>
        <div className="ps-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Wins</label>
            <input type="number" className="ps-input" value={form.wins} onChange={(e) => setField('wins', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Losses</label>
            <input type="number" className="ps-input" value={form.losses} onChange={(e) => setField('losses', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Draws</label>
            <input type="number" className="ps-input" value={form.draws} onChange={(e) => setField('draws', Number(e.target.value))} />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Games Played</label>
            <input type="number" className="ps-input" value={form.gamesPlayed} onChange={(e) => setField('gamesPlayed', Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="ps-save-bar">
        <button className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><Loader2 size={14} className="ps-spin" /> Saving...</> : 'Save Entry'}
        </button>
        {saveStatus === 'saved' && (
          <span className="ps-save-msg ps-save-ok"><Check size={14} /> {saveMsg}</span>
        )}
        {saveStatus === 'error' && (
          <span className="ps-save-msg ps-save-err"><AlertCircle size={14} /> {saveMsg}</span>
        )}
      </div>
    </div>
  )
}
