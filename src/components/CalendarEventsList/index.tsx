'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { CalendarDays, Plus } from 'lucide-react'
import type { Person } from '@/payload-types'
import {
  AdminPage,
  AdminPageHeader,
  AdminTable,
  Badge,
  ErrorState,
  SearchInput,
  EMPTY,
  formatDateTime,
  formatNumber,
  useUrlParamState,
} from '@/admin-kit'
import type { AdminTableColumn, BadgeTone } from '@/admin-kit'
import { filterEvents, type CalendarEventRow, type EventWhen } from './filters'

const TYPE: Record<string, { label: string; tone: BadgeTone }> = {
  faceit: { label: 'FACEIT', tone: 'info' },
  owcs: { label: 'OWCS', tone: 'accent' },
  community: { label: 'Community', tone: 'success' },
  internal: { label: 'Internal', tone: 'neutral' },
}
const INTERNAL: Record<string, string> = { seminar: 'Seminar', pugs: 'PUGs', 'internal-tournament': 'Internal tournament', other: 'Other' }
const REGIONS = ['NA', 'EU', 'EMEA', 'SA', 'OCE', 'SEA', 'APAC', 'China', 'global'] as const
const PAGE_SIZE = 60

/** Calendar Events list on the kit; replaces the stock list and its click interceptor. */
export default function CalendarEventsListView() {
  const { user } = useAuth<Person>()
  const [events, setEvents] = useState<CalendarEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useUrlParamState('q', '')
  const [type, setType] = useUrlParamState('type', 'all')
  const [when, setWhen] = useUrlParamState('when', 'upcoming')
  const [region, setRegion] = useUrlParamState('region', 'all')

  const role = (user?.role as string) ?? ''
  const canCreate = role === 'admin' || role === 'staff-manager'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/global-calendar-events?limit=400&depth=0&sort=-dateStart', { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load events (HTTP ${res.status})`)
      const data = await res.json()
      setEvents(data.docs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => filterEvents(events, { search, type, when: when as EventWhen, region }), [events, search, type, when, region])

  const columns: AdminTableColumn<CalendarEventRow>[] = [
    {
      key: 'title',
      header: 'Event',
      render: (e) => (
        <span className="teams-list__name">
          <span>{e.title}</span>
          {e.eventType === 'internal' && e.internalEventType && <span className="teams-list__slug">{INTERNAL[e.internalEventType] ?? e.internalEventType}</span>}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (e) => (e.eventType ? <Badge tone={TYPE[e.eventType]?.tone ?? 'neutral'}>{TYPE[e.eventType]?.label ?? e.eventType}</Badge> : <span className="pug-list__muted">{EMPTY}</span>),
    },
    { key: 'region', header: 'Region', hideOnMobile: true, render: (e) => (e.region ? <Badge uppercase>{e.region}</Badge> : <span className="pug-list__muted">{EMPTY}</span>) },
    { key: 'start', header: 'Starts', render: (e) => formatDateTime(e.dateStart) },
    { key: 'end', header: 'Ends', hideOnMobile: true, render: (e) => (e.dateEnd ? formatDateTime(e.dateEnd) : <span className="pug-list__muted">{EMPTY}</span>) },
    {
      key: 'discord',
      header: 'Discord',
      hideOnMobile: true,
      render: (e) => (e.publishToDiscord ? <Badge tone="success" dot>Published</Badge> : <span className="pug-list__muted">Not posted</span>),
    },
  ]

  return (
    <AdminPage width="default" className="calendar-events-list">
      <AdminPageHeader
        title="Calendar Events"
        subtitle={loading ? 'Loading events' : `${formatNumber(visible.length)} ${when === 'all' ? 'events' : `${when} events`}`}
        icon={<CalendarDays size={22} />}
        breadcrumbs={[{ label: 'Calendar Events' }]}
        actions={
          <>
            <Link href="/admin/calendar" className="ps-btn ps-btn-ghost teams-list__new">Open calendar</Link>
            {canCreate && (
              <Link href="/admin/edit-event" className="ps-btn ps-btn-primary teams-list__new">
                <Plus size={14} aria-hidden /> New event
              </Link>
            )}
          </>
        }
      />

      <div className="pug-list__toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search events" aria-label="Search events" hotkey />
        <div className="ps-tabs" role="group" aria-label="When">
          {(['upcoming', 'past', 'all'] as const).map((w) => (
            <button key={w} type="button" className={`ps-tab${when === w ? ' ps-tab-active' : ''}`} onClick={() => setWhen(w)} aria-pressed={when === w}>
              {w === 'all' ? 'All' : w === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
        <div className="ps-tabs" role="group" aria-label="Type">
          {(['all', 'faceit', 'owcs', 'community', 'internal'] as const).map((t) => (
            <button key={t} type="button" className={`ps-tab${type === t ? ' ps-tab-active' : ''}`} onClick={() => setType(t)} aria-pressed={type === t}>
              {t === 'all' ? 'All types' : TYPE[t].label}
            </button>
          ))}
        </div>
        <select className="ps-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          <option value="all">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r === 'global' ? 'Global' : r}</option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <AdminTable
          aria-label="Calendar events"
          columns={columns}
          rows={visible.slice(0, PAGE_SIZE)}
          rowKey={(e) => e.id}
          loading={loading}
          rowHref={(e) => `/admin/edit-event?id=${e.id}`}
          emptyTitle={events.length === 0 ? 'No events yet' : when === 'upcoming' ? 'Nothing upcoming matches' : 'No events match these filters'}
          emptyHint={events.length === 0 && canCreate ? 'Add tournaments, community nights and internal dates so they show on the org calendar.' : undefined}
          footer={visible.length > PAGE_SIZE ? `Showing the first ${PAGE_SIZE} of ${visible.length}. Narrow the filters to see the rest.` : undefined}
        />
      )}
    </AdminPage>
  )
}
