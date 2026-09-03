'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardList, Inbox, Swords } from 'lucide-react'
import type { Person } from '@/payload-types'
import { Badge, EmptyState, ErrorState, LoadingState, SectionCard, StatCard, formatDateTime, formatRelative } from '@/admin-kit'
import type { BadgeTone } from '@/admin-kit'
import { buildNavAreas, type NavArea } from '@/components/AdminNav/buildNav'
import { taskHref } from '@/components/UnifiedCalendar/range'
import { DEPARTMENT_LABEL, greeting, isOverdue, mergeUpcoming, type DashboardSummary, type Department, type TaskLite } from './summary'

const PRIORITY_TONE: Record<string, BadgeTone> = { urgent: 'danger', high: 'warning', medium: 'info', low: 'neutral' }

function TaskRow({ task, showDepartment }: { task: TaskLite; showDepartment?: boolean }) {
  const overdue = isOverdue(task)
  return (
    <li className="dash__row">
      <Link href={taskHref(task.department, task.id)} className="dash__row-main">
        <span className="dash__row-title">{task.title}</span>
        <span className="dash__row-meta">
          {showDepartment && task.department && <Badge size="sm">{DEPARTMENT_LABEL[task.department as Department] ?? task.department}</Badge>}
          {task.isRequest && task.requestedByDepartment && (
            <Badge size="sm" tone="accent">from {DEPARTMENT_LABEL[task.requestedByDepartment as Department] ?? task.requestedByDepartment}</Badge>
          )}
          {task.priority && task.priority !== 'medium' && (
            <Badge size="sm" tone={PRIORITY_TONE[task.priority] ?? 'neutral'} uppercase>{task.priority}</Badge>
          )}
          {task.dueDate && (
            <span className={`dash__due${overdue ? ' dash__due--overdue' : ''}`} title={formatDateTime(task.dueDate)}>
              {overdue ? 'Overdue, ' : 'Due '}{formatRelative(task.dueDate)}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

function AreasGrid({ areas }: { areas: NavArea[] }) {
  if (areas.length === 0) return null
  return (
    <div className="dash__areas">
      {areas.map((area) => (
        <section key={area.id} className="dash__area" data-area={area.id}>
          <h3 className="dash__area-title">{area.label}</h3>
          <ul className="dash__area-links">
            {area.items.map((item) => (
              <li key={item.id}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/**
 * The admin landing page: what needs you, what is coming up, where to go.
 * One request (/api/dashboard-summary) instead of eight widgets each fetching.
 */
const BeforeDashboard: React.FC = () => {
  const { user, permissions } = useAuth<Person>()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/dashboard-summary', { credentials: 'include' })
      if (!res.ok) throw new Error(`Could not load your dashboard (HTTP ${res.status})`)
      setSummary(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your dashboard')
    }
  }, [])

  useEffect(() => {
    if (user?.id) void load()
  }, [user?.id, load])

  // Same information architecture as the sidebar, read from the viewer's permissions.
  const areas = useMemo(() => {
    if (!user) return []
    const readable = (map: Record<string, { read?: unknown } | undefined> | undefined) =>
      Object.entries(map ?? {})
        .filter(([, p]) => Boolean(p?.read))
        .map(([slug]) => slug)
    return buildNavAreas({
      user: user as any,
      collections: readable(permissions?.collections as any),
      globals: readable(permissions?.globals as any),
    }).filter((a) => a.id !== 'me')
  }, [user, permissions])

  if (!user) return null

  const upcoming = summary ? mergeUpcoming(summary.upcoming.matches, summary.upcoming.events) : []
  const hour = new Date().getHours()

  return (
    <div className="dash">
      <header className="dash__header">
        <div>
          <h2 className="dash__greeting">{greeting(hour, user.name)}</h2>
          <p className="dash__subtitle">
            {summary
              ? summary.tasks.mine.length === 0
                ? 'Nothing is waiting on you right now.'
                : `${summary.tasks.mine.length} open task${summary.tasks.mine.length === 1 ? '' : 's'}${summary.tasks.overdueMine ? `, ${summary.tasks.overdueMine} overdue` : ''}.`
              : 'Loading what needs you…'}
          </p>
        </div>
        <Link href="/admin/calendar" className="ps-btn ps-btn-ghost dash__header-action">
          <CalendarDays size={14} aria-hidden /> Open calendar
        </Link>
      </header>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !summary ? (
        <LoadingState rows={6} />
      ) : (
        <>
          {summary.attention && (
            <div className="dash__stats">
              <StatCard
                label="Unresolved errors"
                value={summary.attention.unresolvedErrors}
                tone={summary.attention.unresolvedErrors > 0 ? 'danger' : 'success'}
                icon={<AlertTriangle size={16} />}
                href="/admin/globals/system-health?tab=errors"
              />
              <StatCard
                label="Failed cron runs (24h)"
                value={summary.attention.failedCronRuns24h}
                tone={summary.attention.failedCronRuns24h > 0 ? 'warning' : 'success'}
                href="/admin/globals/system-health?tab=cron"
              />
              <StatCard
                label="Overdue tasks (all boards)"
                value={summary.attention.overdueTasks}
                tone={summary.attention.overdueTasks > 0 ? 'warning' : 'success'}
                icon={<ClipboardList size={16} />}
                href="/admin/collections/tasks"
              />
            </div>
          )}

          <div className="dash__grid">
            <SectionCard title="My tasks" description="Assigned to you and not complete" flush>
              {summary.tasks.mine.length === 0 ? (
                <EmptyState compact title="Nothing assigned to you" icon={<ClipboardList size={18} />} />
              ) : (
                <ul className="dash__list">
                  {summary.tasks.mine.map((t) => <TaskRow key={t.id} task={t} showDepartment />)}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Coming up"
              description={`Matches and org events in the next ${summary.upcoming.windowDays} days`}
              actions={<Link href="/admin/calendar" className="dash__link">Calendar <ArrowRight size={12} aria-hidden /></Link>}
              flush
            >
              {upcoming.length === 0 ? (
                <EmptyState compact title="Nothing scheduled" icon={<CalendarDays size={18} />} />
              ) : (
                <ul className="dash__list">
                  {upcoming.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="dash__row">
                      <Link
                        href={item.kind === 'match' ? `/admin/collections/matches/${item.id}` : `/admin/edit-event?id=${item.id}`}
                        className="dash__row-main"
                      >
                        <span className="dash__row-title">{item.title}</span>
                        <span className="dash__row-meta">
                          <Badge size="sm" tone={item.kind === 'match' ? 'info' : 'neutral'} uppercase>{item.kind}</Badge>
                          <span>{item.subtitle}</span>
                          <span className="dash__when">{formatDateTime(item.date)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {summary.tasks.requests.length > 0 && (
              <SectionCard title="Requests for your departments" description="New requests waiting to be picked up" flush>
                <ul className="dash__list">
                  {summary.tasks.requests.map((t) => <TaskRow key={t.id} task={t} showDepartment />)}
                </ul>
              </SectionCard>
            )}

            {summary.recentScrims && (
              <SectionCard
                title="Recent scrims"
                actions={<Link href="/admin/scrims" className="dash__link">All scrims <ArrowRight size={12} aria-hidden /></Link>}
                flush
              >
                {summary.recentScrims.length === 0 ? (
                  <EmptyState compact title="No scrims uploaded yet" icon={<Swords size={18} />} action={<Link href="/admin/scrim-upload" className="ps-btn ps-btn-primary">Upload a scrim</Link>} />
                ) : (
                  <ul className="dash__list">
                    {summary.recentScrims.map((s) => (
                      <li key={s.id} className="dash__row">
                        <Link href={s.firstMapDataId ? `/admin/scrim-map?mapId=${s.firstMapDataId}` : '/admin/scrims'} className="dash__row-main">
                          <span className="dash__row-title">{s.name}</span>
                          <span className="dash__row-meta">
                            <span>{s.mapCount} map{s.mapCount === 1 ? '' : 's'}</span>
                            <span className="dash__when">{formatRelative(s.date)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}
          </div>

          <SectionCard title="Your areas" description="The same map as the sidebar" className="dash__areas-card">
            {areas.length === 0 ? <EmptyState compact title="No areas yet" icon={<Inbox size={18} />} /> : <AreasGrid areas={areas} />}
          </SectionCard>
        </>
      )}
    </div>
  )
}

export default BeforeDashboard
