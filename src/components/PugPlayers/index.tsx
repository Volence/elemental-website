'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { PUG_REGIONS, VALID_REGIONS, pugRegionLabel } from '@/pug/types'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, AlertCircle, Loader2, ShieldAlert, Users } from 'lucide-react'
import {
  AdminPagination,
  AdminTable,
  Badge,
  ErrorState,
  SearchInput,
  formatDate,
  formatNumber,
  formatRecord,
  getPersonLabel,
  EMPTY,
  useUrlParamState,
} from '@/admin-kit'
import type { AdminTableColumn, SortDirection } from '@/admin-kit'
import { pugTabHref } from '@/components/PugDashboard/tabs'
import {
  DEFAULT_PLAYER_FILTERS,
  filterPlayers,
  isBanned,
  joinRatings,
  sortPlayers,
  type LeaderboardRow,
  type PlayerFilters,
  type PlayerSortKey,
  type PugPlayerRow,
  type RatingSummary,
} from './filters'

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank',
  'flex-dps': 'Flex DPS',
  'hitscan-dps': 'Hitscan DPS',
  'flex-support': 'Flex Support',
  'main-support': 'Main Support',
}

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

const REGION_OPTIONS = PUG_REGIONS.map((r) => ({ value: r.value, label: r.label }))

const TIER_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'invite', label: 'Invite' },
]

const PAGE_SIZE = 25

// ---- List View ----

export function PugPlayersListView() {
  const [players, setPlayers] = useState<PugPlayerRow[]>([])
  const [ratings, setRatings] = useState<Map<number, RatingSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters live in the URL so a filtered view is shareable and survives reload.
  const [search, setSearch] = useUrlParamState('q', '')
  const [tier, setTier] = useUrlParamState('tier', 'all')
  const [region, setRegion] = useUrlParamState('region', 'all')
  const [status, setStatus] = useUrlParamState('status', 'all')
  const [sortKey, setSortKey] = useUrlParamState('sort', 'name')
  const [sortDir, setSortDir] = useUrlParamState('dir', 'asc')
  const [pageParam, setPage] = useUrlParamState('page', '1')
  const page = Math.max(1, parseInt(pageParam, 10) || 1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [peopleRes, seasonsRes] = await Promise.all([
        fetch('/api/people?limit=1000&sort=name&depth=0&where[pugTiers][exists]=true', { credentials: 'include' }),
        fetch('/api/pug-seasons?limit=10&depth=0&where[active][equals]=true', { credentials: 'include' }),
      ])
      if (!peopleRes.ok) throw new Error(`Could not load players (HTTP ${peopleRes.status})`)
      const peopleData = await peopleRes.json()
      const docs: PugPlayerRow[] = (peopleData.docs ?? []).filter((p: PugPlayerRow) => (p.pugTiers ?? []).length > 0)
      setPlayers(docs)

      // Ratings for the active season(s). Failure here degrades to "no rating", not an error.
      if (seasonsRes.ok) {
        const seasons = await seasonsRes.json()
        const ids: number[] = (seasons.docs ?? []).map((s: { id: number }) => s.id)
        if (ids.length > 0) {
          const where = ids.map((id, i) => `where[season][in][${i}]=${id}`).join('&')
          const lbRes = await fetch(`/api/pug-leaderboard?limit=2000&depth=0&${where}`, { credentials: 'include' })
          if (lbRes.ok) {
            const lb = await lbRes.json()
            setRatings(joinRatings((lb.docs ?? []) as LeaderboardRow[]))
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load players')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filters: PlayerFilters = useMemo(
    () => ({
      search,
      tier: (tier as PlayerFilters['tier']) ?? 'all',
      region: (region as PlayerFilters['region']) ?? 'all',
      status: (status as PlayerFilters['status']) ?? 'all',
    }),
    [search, tier, region, status],
  )

  const visible = useMemo(() => {
    const filtered = filterPlayers(players, filters)
    return sortPlayers(filtered, ratings, sortKey as PlayerSortKey, sortDir as SortDirection)
  }, [players, filters, ratings, sortKey, sortDir])

  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const onSort = (key: string, direction: SortDirection) => {
    setSortKey(key)
    setSortDir(direction)
    setPage('1')
  }

  const setFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setPage('1')
  }

  const columns: AdminTableColumn<PugPlayerRow>[] = [
    {
      key: 'name',
      header: 'Player',
      sortable: true,
      render: (p) => (
        <div className="pug-players__name">
          <span>{getPersonLabel(p)}</span>
          {p.pugBattleTag && <span className="pug-players__battletag">{p.pugBattleTag}</span>}
        </div>
      ),
    },
    {
      key: 'tiers',
      header: 'Tier',
      render: (p) => (
        <span className="pug-players__badges">
          {(p.pugTiers ?? []).map((t) => (
            <Badge key={t} tone={t === 'invite' ? 'accent' : 'info'} uppercase>
              {t}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'regions',
      header: 'Regions',
      hideOnMobile: true,
      render: (p) =>
        (p.pugInviteRegions ?? []).length ? (
          <span className="pug-players__badges">
            {(p.pugInviteRegions ?? []).map((r) => (
              <Badge key={r} uppercase>
                {r}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="pug-players__muted">{EMPTY}</span>
        ),
    },
    {
      key: 'roles',
      header: 'Roles',
      hideOnMobile: true,
      render: (p) =>
        (p.pugApprovedRoles ?? []).length ? (
          (p.pugApprovedRoles ?? []).map((r) => ROLE_LABELS[r] ?? r).join(', ')
        ) : (
          <span className="pug-players__muted">{EMPTY}</span>
        ),
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      sortable: true,
      render: (p) => {
        const r = ratings.get(p.id)
        return r ? formatNumber(r.rating) : <span className="pug-players__muted">{EMPTY}</span>
      },
    },
    {
      key: 'games',
      header: 'Record',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (p) => {
        const r = ratings.get(p.id)
        return r && r.gamesPlayed > 0 ? (
          <span title={`${r.gamesPlayed} games`}>{formatRecord({ w: r.wins, l: r.losses, d: r.draws })}</span>
        ) : (
          <span className="pug-players__muted">{EMPTY}</span>
        )
      },
    },
    {
      key: 'registered',
      header: 'Registered',
      sortable: true,
      hideOnMobile: true,
      render: (p) => formatDate(p.pugRegisteredDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) =>
        isBanned(p.pugActiveBan) ? (
          <Badge tone="danger" dot title={p.pugActiveBan?.reason ?? undefined}>
            Banned
          </Badge>
        ) : !p.discordId ? (
          <Badge tone="warning">No Discord</Badge>
        ) : (
          <Badge tone="success" dot>
            Active
          </Badge>
        ),
    },
  ]

  return (
    <div className="ps-wrap pug-players">
      <div className="ps-header">
        <h2 className="ps-title">
          Players <span className="pug-players__count">({formatNumber(visible.length)})</span>
        </h2>
      </div>

      <div className="pug-players__toolbar">
        <SearchInput
          value={search}
          onChange={setFilter(setSearch)}
          placeholder="Search name, email or battletag"
          aria-label="Search players"
        />
        <div className="ps-tabs" role="group" aria-label="Tier">
          {(['all', 'open', 'invite'] as const).map((t) => (
            <button key={t} type="button" className={`ps-tab${tier === t ? ' ps-tab-active' : ''}`} onClick={() => setFilter(setTier)(t)} aria-pressed={tier === t}>
              {t === 'all' ? 'All tiers' : t === 'open' ? 'Open' : 'Invite'}
            </button>
          ))}
        </div>
        <div className="ps-tabs" role="group" aria-label="Region">
          {(['all', ...VALID_REGIONS] as const).map((r) => (
            <button key={r} type="button" className={`ps-tab${region === r ? ' ps-tab-active' : ''}`} onClick={() => setFilter(setRegion)(r)} aria-pressed={region === r}>
              {r === 'all' ? 'All regions' : pugRegionLabel(r)}
            </button>
          ))}
        </div>
        <div className="ps-tabs" role="group" aria-label="Status">
          {(['all', 'banned', 'unlinked'] as const).map((s) => (
            <button key={s} type="button" className={`ps-tab${status === s ? ' ps-tab-active' : ''}`} onClick={() => setFilter(setStatus)(s)} aria-pressed={status === s}>
              {s === 'all' ? 'Any status' : s === 'banned' ? 'Banned' : 'No Discord'}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <AdminTable
            aria-label="PUG players"
            columns={columns}
            rows={pageRows}
            rowKey={(p) => p.id}
            loading={loading}
            sort={{ key: sortKey, direction: sortDir as SortDirection }}
            onSort={onSort}
            rowHref={(p) => `/admin/edit-pug-player?id=${p.id}`}
            emptyTitle={players.length === 0 ? 'No registered PUG players yet' : 'No players match these filters'}
            emptyHint={players.length === 0 ? 'Players appear here after they register through /pugs.' : undefined}
          />
          {visible.length > PAGE_SIZE && (
            <AdminPagination page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={(p) => setPage(String(p))} />
          )}
        </>
      )}
    </div>
  )
}

// ---- Edit View ----

export function PugPlayersEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState({
    userName: '',
    battleTag: '',
    tiers: [] as string[],
    approvedRoles: [] as string[],
    inviteRegions: [] as string[],
    registeredDate: '',
    invitedByName: '',
    bannedUntil: '',
    banReason: '',
    banOffenseCount: 0,
  })

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    fetch(`/api/people/${id}?depth=1`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: any) => {
        const invitedByName =
          typeof data.pugInvitedBy === 'object' && data.pugInvitedBy ? getPersonLabel(data.pugInvitedBy) : ''
        setForm({
          userName: getPersonLabel(data),
          battleTag: data.pugBattleTag ?? '',
          tiers: data.pugTiers ?? [],
          approvedRoles: data.pugApprovedRoles ?? [],
          inviteRegions: data.pugInviteRegions ?? [],
          registeredDate: data.pugRegisteredDate ? data.pugRegisteredDate.split('T')[0] : '',
          invitedByName,
          bannedUntil: data.pugActiveBan?.bannedUntil ? data.pugActiveBan.bannedUntil.split('T')[0] : '',
          banReason: data.pugActiveBan?.reason ?? '',
          banOffenseCount: data.pugBanOffenseCount ?? 0,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  function toggleArrayItem(key: 'tiers' | 'approvedRoles' | 'inviteRegions', value: string) {
    setForm((f) => {
      const arr = f[key]
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...f, [key]: next }
    })
    setSaveStatus('idle')
  }

  async function save() {
    if (!id) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const body = {
        pugTiers: form.tiers,
        pugApprovedRoles: form.approvedRoles,
        pugInviteRegions: form.inviteRegions,
        pugActiveBan: {
          bannedUntil: form.bannedUntil || null,
          reason: form.banReason || null,
        },
      }
      const res = await fetch(`/api/people/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const backHref = pugTabHref('players')

  if (loading) {
    return (
      <div className="ps-wrap">
        <div className="pug-players__muted">Loading player...</div>
      </div>
    )
  }

  const hasInvite = form.tiers.includes('invite')

  return (
    <div className="ps-wrap">
      <button type="button" className="ps-back" onClick={() => router.push(backHref)}>
        <ArrowLeft size={14} /> Back to Players
      </button>

      <p className="ps-form-title">
        <Users size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />
        {form.userName || 'PUG Player'}
      </p>

      {/* Details */}
      <div className="ps-section">
        <p className="ps-section-title">Details</p>
        <div className="ps-row ps-row-3" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Name</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.userName}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">BattleTag</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.battleTag || EMPTY}</div>
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Registered</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.registeredDate || EMPTY}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label">Tiers</label>
          <div className="ps-pills">
            {TIER_OPTIONS.map((t) => (
              <button
                type="button"
                key={t.value}
                className={`ps-pill ${form.tiers.includes(t.value) ? 'ps-pill-active' : ''}`}
                onClick={() => toggleArrayItem('tiers', t.value)}
                aria-pressed={form.tiers.includes(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Settings */}
      {hasInvite && (
        <div className="ps-section">
          <p className="ps-section-title">Invite Settings</p>
          <div className="ps-field">
            <label className="ps-label">Regions</label>
            <div className="ps-pills">
              {REGION_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  className={`ps-pill ${form.inviteRegions.includes(r.value) ? 'ps-pill-active' : ''}`}
                  onClick={() => toggleArrayItem('inviteRegions', r.value)}
                  aria-pressed={form.inviteRegions.includes(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ps-field">
            <label className="ps-label">Approved Roles</label>
            <div className="ps-pills">
              {ROLE_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  className={`ps-pill ${form.approvedRoles.includes(r.value) ? 'ps-pill-active' : ''}`}
                  onClick={() => toggleArrayItem('approvedRoles', r.value)}
                  aria-pressed={form.approvedRoles.includes(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {form.invitedByName && (
            <div className="ps-field">
              <label className="ps-label">Invited By</label>
              <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.invitedByName}</div>
            </div>
          )}
        </div>
      )}

      {/* Ban Status */}
      <div className="ps-section">
        <p className="ps-section-title">
          <ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
          Ban Status
        </p>
        <div className="ps-row ps-row-2" style={{ marginBottom: 16 }}>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label" htmlFor="pug-banned-until">Banned Until</label>
            <input
              id="pug-banned-until"
              type="date"
              className="ps-input"
              value={form.bannedUntil}
              onChange={(e) => {
                setForm((f) => ({ ...f, bannedUntil: e.target.value }))
                setSaveStatus('idle')
              }}
            />
          </div>
          <div className="ps-field" style={{ margin: 0 }}>
            <label className="ps-label">Offense Count</label>
            <div className="ps-input" style={{ cursor: 'default', opacity: 0.7 }}>{form.banOffenseCount}</div>
          </div>
        </div>
        <div className="ps-field">
          <label className="ps-label" htmlFor="pug-ban-reason">Reason</label>
          <input
            id="pug-ban-reason"
            className="ps-input"
            value={form.banReason}
            onChange={(e) => {
              setForm((f) => ({ ...f, banReason: e.target.value }))
              setSaveStatus('idle')
            }}
            placeholder="Ban reason"
          />
        </div>
        <p className="pug-players__muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
          Bans set here do not increase the offense count. Use the Moderation tab for escalating bans.
        </p>
      </div>

      {/* Save */}
      <div className="ps-save-bar">
        <button type="button" className="ps-btn ps-btn-primary" onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? (
            <>
              <Loader2 size={14} className="ps-spin" /> Saving...
            </>
          ) : (
            'Save Player'
          )}
        </button>
        {saveStatus === 'saved' && (
          <span className="ps-save-msg ps-save-ok" role="status">
            <Check size={14} /> {saveMsg}
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="ps-save-msg ps-save-err" role="alert">
            <AlertCircle size={14} /> {saveMsg}
          </span>
        )}
      </div>
    </div>
  )
}
