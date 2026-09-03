'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { CalendarItem, Department } from './types'
import { taskHref } from './range'

interface UseUnifiedCalendarDataOptions {
  startDate: Date
  endDate: Date
}

export type CalendarLane = 'tasks' | 'matches' | 'events'

interface UseUnifiedCalendarDataReturn {
  /** Every item in range, all departments. Filter client-side; it is cheap and avoids refetching. */
  items: CalendarItem[]
  loading: boolean
  /** Fatal: nothing could be loaded. */
  error: string | null
  /** Lanes that answered with an error (usually 403 for a role that cannot read them). */
  unavailable: CalendarLane[]
  refetch: () => void
}

async function readLane(res: Response): Promise<{ docs: any[] } | null> {
  if (!res.ok) return null
  try {
    return (await res.json()) as { docs: any[] }
  } catch {
    return null
  }
}

/**
 * Loads tasks, matches and org events for the rendered range.
 *
 * - One request set per range. Department filtering happens in the view.
 * - Overlapping fetches are cancelled with AbortController, so rapid Next / Previous
 *   never leaves stale data on screen.
 * - A lane that fails (403 for staff outside a department, 500) is reported in
 *   `unavailable` instead of silently rendering as "nothing scheduled".
 * - Social posts are no longer a lane: they are planned as social-media tasks.
 */
export function useUnifiedCalendarData({ startDate, endDate }: UseUnifiedCalendarDataOptions): UseUnifiedCalendarDataReturn {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<CalendarLane[]>([])
  const [version, setVersion] = useState(0)

  const startISO = useMemo(() => startDate.toISOString(), [startDate])
  const endISO = useMemo(() => endDate.toISOString(), [endDate])
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setLoading(true)
    setError(null)

    const run = async () => {
      const opts: RequestInit = { credentials: 'include', signal }
      const [tasksRes, matchesRes, eventsRes] = await Promise.all([
        fetch(
          `/api/tasks?${new URLSearchParams({
            where: JSON.stringify({
              dueDate: { greater_than_equal: startISO, less_than: endISO },
              archived: { not_equals: true },
            }),
            sort: 'dueDate',
            limit: '500',
            depth: '0',
          })}`,
          opts,
        ),
        fetch(
          `/api/matches?` +
            `where[date][greater_than_equal]=${encodeURIComponent(startISO)}&` +
            `where[date][less_than]=${encodeURIComponent(endISO)}&` +
            `where[status][not_equals]=cancelled&` +
            `sort=date&limit=500&depth=0`,
          opts,
        ),
        fetch(
          `/api/global-calendar-events?` +
            `where[or][0][and][0][dateStart][less_than]=${encodeURIComponent(endISO)}&` +
            `where[or][0][and][1][dateEnd][greater_than_equal]=${encodeURIComponent(startISO)}&` +
            `where[or][1][and][0][dateStart][less_than]=${encodeURIComponent(endISO)}&` +
            `where[or][1][and][1][dateStart][greater_than_equal]=${encodeURIComponent(startISO)}&` +
            `where[or][1][and][2][dateEnd][exists]=false&` +
            `sort=dateStart&limit=500&depth=0`,
          opts,
        ),
      ])

      const [tasks, matches, events] = await Promise.all([readLane(tasksRes), readLane(matchesRes), readLane(eventsRes)])
      if (signal.aborted) return

      const missing: CalendarLane[] = []
      if (!tasks) missing.push('tasks')
      if (!matches) missing.push('matches')
      if (!events) missing.push('events')
      if (missing.length === 3) {
        throw new Error(`Calendar data could not be loaded (HTTP ${tasksRes.status} / ${matchesRes.status} / ${eventsRes.status})`)
      }

      const out: CalendarItem[] = []

      for (const task of tasks?.docs ?? []) {
        if (!task.dueDate) continue
        out.push({
          id: String(task.id),
          type: 'task',
          title: task.title || 'Untitled task',
          date: new Date(task.dueDate),
          department: task.department as Department,
          status: task.status,
          priority: task.priority,
          href: taskHref(task.department, task.id),
          meta: { taskType: task.taskType, isRequest: task.isRequest, postType: task.postType, platform: task.platform },
        })
      }

      for (const match of matches?.docs ?? []) {
        if (!match.date) continue
        out.push({
          id: String(match.id),
          type: 'match',
          title: match.title || 'Match',
          date: new Date(match.date),
          department: 'production',
          status: match.status,
          href: `/admin/collections/matches/${match.id}`,
          meta: { opponent: match.opponent, league: match.league, region: match.region },
        })
      }

      for (const event of events?.docs ?? []) {
        if (!event.dateStart) continue
        out.push({
          id: String(event.id),
          type: 'calendar-event',
          title: event.title || 'Event',
          date: new Date(event.dateStart),
          dateEnd: event.dateEnd ? new Date(event.dateEnd) : undefined,
          department: 'competitive',
          status: undefined,
          href: `/admin/edit-event?id=${event.id}`,
          meta: {
            eventType: event.eventType,
            internalEventType: event.internalEventType,
            region: event.region,
            links: event.links,
            description: event.description,
          },
        })
      }

      out.sort((a, b) => a.date.getTime() - b.date.getTime())
      setItems(out)
      setUnavailable(missing)
    }

    run()
      .catch((err: unknown) => {
        if (signal.aborted) return
        console.error('Error fetching calendar data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch calendar data')
        setItems([])
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [startISO, endISO, version])

  return { items, loading, error, unavailable, refetch }
}
