'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { CalendarRange, Plus } from 'lucide-react'
import type { Person } from '@/payload-types'
import {
  AdminPage,
  AdminPageHeader,
  AdminTable,
  Badge,
  ErrorState,
  SearchInput,
  EMPTY,
  formatDate,
  formatNumber,
  formatRelative,
  useUrlParamState,
} from '@/admin-kit'
import type { AdminTableColumn, BadgeTone } from '@/admin-kit'

interface ScheduleRow {
  id: number
  pollName?: string | null
  team?: number | { id: number; name?: string | null } | null
  scheduleType?: 'poll' | 'calendar' | 'manual' | string | null
  status?: 'active' | 'closed' | 'scheduled' | string | null
  dateRange?: { start?: string | null; end?: string | null } | null
  responseCount?: number | null
  publishedToCalendar?: boolean | null
  createdAt: string
}

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  closed: { label: 'Closed', tone: 'neutral' },
}
const SOURCE: Record<string, string> = { poll: 'Discord poll', calendar: 'Availability', manual: 'Manual' }
const PAGE_SIZE = 60

const teamId = (t: ScheduleRow['team']) => (typeof t === 'object' && t ? t.id : typeof t === 'number' ? t : null)
const teamName = (t: ScheduleRow['team']) => (typeof t === 'object' && t ? t.name ?? `Team #${t.id}` : t ? `Team #${t}` : null)

/**
 * Team schedules (the discord-polls collection) on the kit. Replaces the stock
 * list and the "my teams / all teams" dropdown with a plain toggle.
 */
export default function SchedulesListView() {
  const { user } = useAuth<Person>()
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useUrlParamState('q', '')
  const [status, setStatus] = useUrlParamState('status', 'open')
  const [team, setTeam] = useUrlParamState('team', 'all')
  const [mineParam, setMine] = useUrlParamState('mine', '0')

  const role = (user?.role as string) ?? ''
  const canCreate = ['admin', 'staff-manager', 'team-manager'].includes(role)
  const assignedIds = useMemo(
    () => ((user?.assignedTeams ?? []) as Array<number | { id: number }>).map((t) => (typeof t === 'object' ? t.id : t)),
    [user?.assignedTeams],
  )
  const mine = mineParam === '1'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discord-polls?limit=300&depth=1&sort=-createdAt', { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load schedules (HTTP ${res.status})`)
      const data = await res.json()
      setRows(data.docs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load schedules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const teams = useMemo(() => {
    const seen = new Map<number, string>()
    for (const r of rows) {
      const id = teamId(r.team)
      if (id !== null && !seen.has(id)) seen.set(id, teamName(r.team) ?? `Team #${id}`)
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((r) => {
      const id = teamId(r.team)
      if (mine && (id === null || !assignedIds.includes(id))) return false
      if (team !== 'all' && String(id) !== team) return false
      if (status === 'open' && r.status === 'closed') return false
      if (status !== 'open' && status !== 'all' && r.status !== status) return false
      if (needle && !(r.pollName ?? '').toLowerCase().includes(needle) && !(teamName(r.team) ?? '').toLowerCase().includes(needle)) return false
      return true
    })
  }, [rows, search, status, team, mine, assignedIds])

  const columns: AdminTableColumn<ScheduleRow>[] = [
    { key: 'name', header: 'Schedule', render: (r) => r.pollName || <span className="pug-list__muted">Untitled</span> },
    { key: 'team', header: 'Team', render: (r) => teamName(r.team) ?? <span className="pug-list__muted">{EMPTY}</span> },
    {
      key: 'dates',
      header: 'Dates',
      hideOnMobile: true,
      nowrap: true,
      render: (r) =>
        r.dateRange?.start ? (
          <span>
            {formatDate(r.dateRange.start)}
            {r.dateRange.end && <span className="pug-list__muted"> to {formatDate(r.dateRange.end)}</span>}
          </span>
        ) : (
          <span className="pug-list__muted">{EMPTY}</span>
        ),
    },
    { key: 'source', header: 'Source', hideOnMobile: true, render: (r) => (r.scheduleType ? <Badge>{SOURCE[r.scheduleType] ?? r.scheduleType}</Badge> : <span className="pug-list__muted">{EMPTY}</span>) },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: (r) => (r.status ? <Badge tone={STATUS[r.status]?.tone ?? 'neutral'} dot>{STATUS[r.status]?.label ?? r.status}</Badge> : <span className="pug-list__muted">{EMPTY}</span>),
    },
    { key: 'responses', header: 'Responses', align: 'right', hideOnMobile: true, render: (r) => formatNumber(r.responseCount ?? 0) },
    {
      key: 'published',
      header: 'Calendar',
      hideOnMobile: true,
      render: (r) => (r.publishedToCalendar ? <Badge tone="success" dot>Published</Badge> : <span className="pug-list__muted">Not published</span>),
    },
    { key: 'created', header: 'Created', hideOnMobile: true, nowrap: true, render: (r) => formatRelative(r.createdAt) },
  ]

  return (
    <AdminPage width="default" className="schedules-list">
      <AdminPageHeader
        title="Schedules"
        subtitle={loading ? 'Loading schedules' : `${formatNumber(visible.length)} of ${formatNumber(rows.length)} schedules`}
        icon={<CalendarRange size={22} />}
        breadcrumbs={[{ label: 'Schedules' }]}
        actions={
          canCreate ? (
            <Link href="/admin/collections/discord-polls/create" className="ps-btn ps-btn-primary teams-list__new">
              <Plus size={14} aria-hidden /> New schedule
            </Link>
          ) : undefined
        }
      />

      <div className="pug-list__toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search schedule or team" aria-label="Search schedules" hotkey />
        <div className="ps-tabs" role="group" aria-label="Status">
          {(['open', 'active', 'scheduled', 'closed', 'all'] as const).map((s) => (
            <button key={s} type="button" className={`ps-tab${status === s ? ' ps-tab-active' : ''}`} onClick={() => setStatus(s)} aria-pressed={status === s}>
              {s === 'open' ? 'Open' : s === 'all' ? 'All' : STATUS[s].label}
            </button>
          ))}
        </div>
        {teams.length > 1 && (
          <select className="ps-select" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
            <option value="all">All teams</option>
            {teams.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        )}
        {assignedIds.length > 0 && (
          <label className="ps-check-label pug-list__check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked ? '1' : '0')} />
            Only my teams
          </label>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <AdminTable
          aria-label="Schedules"
          columns={columns}
          rows={visible.slice(0, PAGE_SIZE)}
          rowKey={(r) => r.id}
          loading={loading}
          rowHref={(r) => `/admin/collections/discord-polls/${r.id}`}
          emptyTitle={rows.length === 0 ? 'No schedules yet' : 'No schedules match these filters'}
          emptyHint={rows.length === 0 ? 'Schedules come from Discord polls, availability calendars or manual entry.' : undefined}
          footer={visible.length > PAGE_SIZE ? `Showing the first ${PAGE_SIZE} of ${visible.length}.` : undefined}
        />
      )}
    </AdminPage>
  )
}
