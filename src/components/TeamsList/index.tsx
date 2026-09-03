'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { Plus, Shield } from 'lucide-react'
import type { Person } from '@/payload-types'
import {
  AdminPage,
  AdminPageHeader,
  AdminTable,
  Avatar,
  Badge,
  ErrorState,
  SearchInput,
  EMPTY,
  formatNumber,
  formatRelative,
  getPersonLabel,
  useUrlParamState,
} from '@/admin-kit'
import type { AdminTableColumn, SortDirection } from '@/admin-kit'
import { getTierFromRating } from '@/utilities/tierColors'
import { filterTeams, sortTeams, teamStaffNames, type TeamRow, type TeamSortKey } from './filters'

const REGIONS = ['NA', 'EMEA', 'SA', 'OCE', 'SEA', 'APAC', 'China', 'Other'] as const
const PAGE_SIZE = 50

/**
 * Teams list on the kit, replacing Payload's default list plus five injected
 * add-ons (assigned-teams banner, manager info, read-only styles, cell
 * alignment fixes and a click interceptor that rewrote row links).
 */
export default function TeamsListView() {
  const { user } = useAuth<Person>()
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useUrlParamState('q', '')
  const [region, setRegion] = useUrlParamState('region', 'all')
  const [status, setStatus] = useUrlParamState('status', 'active')
  const [mineParam, setMine] = useUrlParamState('mine', '0')
  const [sortKey, setSortKey] = useUrlParamState('sort', 'name')
  const [sortDir, setSortDir] = useUrlParamState('dir', 'asc')

  const role = (user?.role as string) ?? ''
  const canCreate = role === 'admin' || role === 'staff-manager'
  const assignedIds = useMemo(
    () => ((user?.assignedTeams ?? []) as Array<number | { id: number }>).map((t) => (typeof t === 'object' ? t.id : t)),
    [user?.assignedTeams],
  )
  const mine = mineParam === '1'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/teams?limit=300&depth=1&sort=name', { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load teams (HTTP ${res.status})`)
      const data = await res.json()
      setTeams(data.docs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load teams')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () =>
      sortTeams(
        filterTeams(teams, { search, region, status, onlyIds: mine ? assignedIds : null }),
        sortKey as TeamSortKey,
        sortDir as SortDirection,
      ),
    [teams, search, region, status, mine, assignedIds, sortKey, sortDir],
  )

  const onSort = (key: string, direction: SortDirection) => {
    setSortKey(key)
    setSortDir(direction)
  }

  const columns: AdminTableColumn<TeamRow>[] = [
    {
      key: 'name',
      header: 'Team',
      sortable: true,
      render: (t) => (
        <span className="teams-list__team">
          <Avatar src={typeof t.logo === 'object' && t.logo ? t.logo.url ?? null : null} name={t.name} size={32} />
          <span className="teams-list__name">
            <span>{t.name}</span>
            {t.slug && <span className="teams-list__slug">/{t.slug}</span>}
          </span>
        </span>
      ),
    },
    { key: 'region', header: 'Region', sortable: true, render: (t) => (t.region ? <Badge uppercase>{t.region}</Badge> : <span className="pug-list__muted">{EMPTY}</span>) },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      render: (t) => {
        if (!t.rating) return <span className="pug-list__muted">{EMPTY}</span>
        const tier = getTierFromRating(t.rating)
        return (
          <span className="teams-list__tier" style={{ borderColor: tier.borderColor, color: tier.borderColor }}>
            {t.rating}
          </span>
        )
      },
    },
    {
      key: 'roster',
      header: 'Roster',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (t) => {
        const players = t.roster?.length ?? 0
        const subs = t.subs?.length ?? 0
        return (
          <span title={`${players} players, ${subs} subs`}>
            {formatNumber(players)}
            {subs > 0 && <span className="pug-list__muted"> +{subs}</span>}
          </span>
        )
      },
    },
    {
      key: 'staff',
      header: 'Staff',
      hideOnMobile: true,
      render: (t) => {
        const names = teamStaffNames(t, (p) => getPersonLabel(p as Parameters<typeof getPersonLabel>[0]))
        return names.length ? names.join(', ') : <span className="pug-list__muted">{EMPTY}</span>
      },
    },
    {
      key: 'league',
      header: 'FaceIt',
      hideOnMobile: true,
      render: (t) =>
        t.currentFaceitLeague && typeof t.currentFaceitLeague === 'object' ? t.currentFaceitLeague.name : <span className="pug-list__muted">{EMPTY}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (t) => (t.active === false ? <Badge tone="warning">Inactive</Badge> : <Badge tone="success" dot>Active</Badge>),
    },
    { key: 'updatedAt', header: 'Updated', sortable: true, hideOnMobile: true, render: (t) => formatRelative(t.updatedAt) },
  ]

  return (
    <AdminPage width="default" className="teams-list">
      <AdminPageHeader
        title="Teams"
        subtitle={loading ? 'Loading teams' : `${formatNumber(visible.length)} of ${formatNumber(teams.length)} teams`}
        icon={<Shield size={22} />}
        breadcrumbs={[{ label: 'Teams' }]}
        actions={
          canCreate ? (
            <Link href="/admin/edit-team" className="ps-btn ps-btn-primary teams-list__new">
              <Plus size={14} aria-hidden /> New team
            </Link>
          ) : undefined
        }
      />

      <div className="pug-list__toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or slug" aria-label="Search teams" hotkey />
        <div className="ps-tabs" role="group" aria-label="Status">
          {(['active', 'inactive', 'all'] as const).map((s) => (
            <button key={s} type="button" className={`ps-tab${status === s ? ' ps-tab-active' : ''}`} onClick={() => setStatus(s)} aria-pressed={status === s}>
              {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
        <select className="ps-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          <option value="all">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {assignedIds.length > 0 && (
          <label className="ps-check-label pug-list__check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked ? '1' : '0')} />
            Only my teams ({assignedIds.length})
          </label>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <AdminTable
          aria-label="Teams"
          columns={columns}
          rows={visible.slice(0, PAGE_SIZE)}
          rowKey={(t) => t.id}
          loading={loading}
          sort={{ key: sortKey, direction: sortDir as SortDirection }}
          onSort={onSort}
          rowHref={(t) => `/admin/edit-team?id=${t.id}`}
          emptyTitle={teams.length === 0 ? 'No teams yet' : 'No teams match these filters'}
          emptyHint={teams.length === 0 && canCreate ? 'Create the first team to start building rosters.' : undefined}
          footer={visible.length > PAGE_SIZE ? `Showing the first ${PAGE_SIZE} of ${visible.length}. Narrow the filters to see the rest.` : undefined}
        />
      )}
    </AdminPage>
  )
}
