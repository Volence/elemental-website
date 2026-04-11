'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

interface CalendarEvent {
  id: number
  title: string
  dateStart: string
  eventType: string
  internalEventType?: string
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  match: '#ec4899',
  internal: '#06b6d4',
  external: '#f59e0b',
  other: '#64748b',
}

const INTERNAL_TYPE_COLORS: Record<string, string> = {
  'movie-night': '#a855f7',
  'game-night': '#8b5cf6',
  pug: '#3b82f6',
  seminar: '#06b6d4',
  tournament: '#ec4899',
  other: '#64748b',
}

/**
 * Calendar preview — compact timeline of next 3 days of events.
 */
export default function CalendarPreviewWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    const threeDaysLater = new Date(now)
    threeDaysLater.setDate(now.getDate() + 7) // Fetch a week ahead to guarantee 3 days of events
    const params = new URLSearchParams({
      'where[dateStart][greater_than]': now.toISOString(),
      'where[dateStart][less_than]': threeDaysLater.toISOString(),
      sort: 'dateStart',
      limit: '15',
    })
    fetch(`/api/global-calendar-events?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setEvents((data.docs ?? []).map((d: any) => ({
        id: d.id,
        title: d.title,
        dateStart: d.dateStart,
        eventType: d.eventType,
        internalEventType: d.internalEventType,
      }))))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const getDayLabel = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    if (d.toDateString() === now.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Group events by day
  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = new Date(e.dateStart).toDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})
  const dayKeys = Object.keys(grouped).slice(0, 3)

  const getColor = (e: CalendarEvent) => {
    if (e.eventType === 'internal' && e.internalEventType) {
      return INTERNAL_TYPE_COLORS[e.internalEventType] ?? INTERNAL_TYPE_COLORS.other
    }
    return EVENT_TYPE_COLORS[e.eventType] ?? EVENT_TYPE_COLORS.other
  }

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget__header">
        <CalendarDays size={16} className="dashboard-widget__header-icon" />
        <h3 className="dashboard-widget__title">Upcoming Events</h3>
        <Link href="/admin/calendar" className="dashboard-widget__view-all">Full Calendar →</Link>
      </div>
      <div className="dashboard-widget__body">
        {loading ? (
          <div className="dashboard-widget__loading">Loading…</div>
        ) : dayKeys.length === 0 ? (
          <div className="dashboard-widget__empty">No upcoming events</div>
        ) : (
          <div className="dashboard-calendar">
            {dayKeys.map(dayKey => (
              <div key={dayKey} className="dashboard-calendar__day">
                <div className="dashboard-calendar__day-label">{getDayLabel(grouped[dayKey][0].dateStart)}</div>
                <div className="dashboard-calendar__events">
                  {grouped[dayKey].map(e => (
                    <div key={e.id} className="dashboard-calendar__event">
                      <span className="dashboard-calendar__dot" style={{ background: getColor(e) }} />
                      <span className="dashboard-calendar__event-time">{formatTime(e.dateStart)}</span>
                      <span className="dashboard-calendar__event-title">{e.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
