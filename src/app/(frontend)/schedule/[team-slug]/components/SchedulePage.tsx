'use client'

import React, { useState } from 'react'
import { Calendar, ClipboardList, Wrench, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { ScheduleProvider, useSchedule } from '@/components/scheduling/ScheduleContext'
import type { WeekView } from '@/components/scheduling/ScheduleContext'
import { AvailabilityVoting } from '@/components/scheduling/AvailabilityVoting'
import { AvailabilityMatrix } from '@/components/scheduling/AvailabilityMatrix'
import { CalendarMonth } from '@/components/scheduling/CalendarMonth'
import { AbsenceManager } from '@/components/scheduling/AbsenceManager'
import { WeekScheduleSummary } from '@/components/scheduling/WeekScheduleSummary'
import type { SchedulePageData, ScheduleTab } from '@/components/scheduling/types'
import { BuildTab } from './BuildTab'
import './SchedulePage.css'

interface SchedulePageProps {
  initialData: SchedulePageData
  initialTab: ScheduleTab
}

export function SchedulePage({ initialData, initialTab }: SchedulePageProps) {
  return (
    <ScheduleProvider initialData={initialData} initialTab={initialTab}>
      <SchedulePageInner />
    </ScheduleProvider>
  )
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getWeekLabel(calendar: any): string {
  if (!calendar?.dateRange?.start) return 'Unknown'
  const start = new Date(calendar.dateRange.start)
  const end = new Date(calendar.dateRange.end)
  const fmt = (d: Date) => `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return `${fmt(start)} - ${fmt(end)}`
}

function WeekSwitcher() {
  const { data, weekView, setWeekView } = useSchedule()
  if (!data.nextWeekCalendar) return null

  return (
    <div className="schedule-page__week-switcher">
      <button
        className={`schedule-page__week-btn ${weekView === 'current' ? 'schedule-page__week-btn--active' : ''}`}
        onClick={() => setWeekView('current')}
      >
        <ChevronLeft size={14} />
        This Week
        <span className="schedule-page__week-dates">{getWeekLabel(data.activeCalendar)}</span>
      </button>
      <button
        className={`schedule-page__week-btn ${weekView === 'next' ? 'schedule-page__week-btn--active' : ''}`}
        onClick={() => setWeekView('next')}
      >
        Next Week
        <span className="schedule-page__week-dates">{getWeekLabel(data.nextWeekCalendar)}</span>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

function formatDateKey(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z')
  if (isNaN(d.getTime())) return dateKey
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[d.getUTCDay()]
}

function diffSelections(
  prev: Record<string, Record<string, string>> | undefined,
  curr: Record<string, Record<string, string>> | undefined,
  slotLabelMap: Record<string, string>,
): { added: string[]; removed: string[] } {
  const added: string[] = []
  const removed: string[] = []
  const allDates = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})])

  for (const dateKey of allDates) {
    const dayLabel = formatDateKey(dateKey)
    const prevSlots = (prev || {})[dateKey] || {}
    const currSlots = (curr || {})[dateKey] || {}
    const allTimes = new Set([...Object.keys(prevSlots), ...Object.keys(currSlots)])

    for (const time of allTimes) {
      const prevStatus = prevSlots[time]
      const currStatus = currSlots[time]
      const label = slotLabelMap[time] || time
      const tag = `${dayLabel} ${label}`

      const wasAvail = prevStatus === 'available' || prevStatus === 'maybe'
      const isAvail = currStatus === 'available' || currStatus === 'maybe'

      if (isAvail && !wasAvail) added.push(tag)
      if (wasAvail && !isAvail) removed.push(tag)
    }
  }
  return { added, removed }
}

function ChangesBanner({ calendar }: { calendar: any }) {
  const [expanded, setExpanded] = useState(false)
  const lastBuilt = calendar.schedule?.lastUpdated
  if (!lastBuilt) return null

  const responses = (calendar.responses || []) as any[]
  const changed = responses.filter(
    (r: any) => r.respondedAt && new Date(r.respondedAt) > new Date(lastBuilt)
  )
  if (changed.length === 0) return null

  const timeSlots = (calendar.timeSlots || []) as any[]
  const slotLabelMap: Record<string, string> = {}
  for (const ts of timeSlots) {
    if (ts.startTime && ts.label) slotLabelMap[ts.startTime] = ts.label
  }

  const snapshot: Record<string, Record<string, Record<string, string>>> =
    calendar.schedule?.responseSnapshot || {}

  return (
    <div className="schedule-page__changes-banner-wrap">
      <button
        className="schedule-page__changes-banner"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="schedule-page__changes-dot" />
        {changed.length} new response{changed.length !== 1 ? 's' : ''} since last build
        <ChevronDown
          size={14}
          className={`schedule-page__changes-chevron ${expanded ? 'schedule-page__changes-chevron--open' : ''}`}
        />
      </button>
      {expanded && (
        <div className="schedule-page__changes-details">
          {changed.map((r: any) => {
            const name = (r.discordUsername || 'Unknown').replace(/^@/, '')
            const prev = snapshot[r.discordId]
            const curr = r.selections || {}
            const { added, removed } = diffSelections(prev, curr, slotLabelMap)

            const parts: React.ReactNode[] = []
            if (added.length > 0) {
              parts.push(
                <span key="added" className="schedule-page__changes-added">
                  added {added.join(', ')}
                </span>
              )
            }
            if (removed.length > 0) {
              parts.push(
                <span key="removed" className="schedule-page__changes-removed">
                  removed {removed.join(', ')}
                </span>
              )
            }
            if (parts.length === 0 && !prev) {
              const daySlots: string[] = []
              for (const [dateKey, slots] of Object.entries(curr)) {
                const dayLabel = formatDateKey(dateKey)
                const times = Object.entries(slots as Record<string, string>)
                  .filter(([, status]) => status === 'available' || status === 'maybe')
                  .map(([time]) => slotLabelMap[time] || time)
                if (times.length > 0) daySlots.push(`${dayLabel} ${times.join(', ')}`)
              }
              parts.push(
                <span key="new" className="schedule-page__changes-added">
                  {daySlots.length > 0 ? `new: ${daySlots.join(' / ')}` : 'responded (no availability)'}
                </span>
              )
            }
            if (parts.length === 0) {
              parts.push(<span key="same" className="schedule-page__changes-neutral">updated (no slot changes)</span>)
            }

            return (
              <div key={r.discordId} className="schedule-page__changes-player">
                <span className="schedule-page__changes-name">{name}</span>
                <span className="schedule-page__changes-avail">
                  {parts.reduce<React.ReactNode[]>((acc, part, i) => {
                    if (i > 0) acc.push(<span key={`sep-${i}`} className="schedule-page__changes-sep"> / </span>)
                    acc.push(part)
                    return acc
                  }, [])}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SchedulePageInner() {
  const { data, activeTab, setActiveTab, viewedCalendar } = useSchedule()
  const calendarKey = viewedCalendar?.id || 'none'

  const tabs: { key: ScheduleTab; label: string; icon: React.ReactNode; managerOnly?: boolean }[] = [
    { key: 'availability', label: 'Availability', icon: <ClipboardList size={16} /> },
    { key: 'calendar', label: 'Calendar', icon: <Calendar size={16} /> },
    { key: 'build', label: 'Build', icon: <Wrench size={16} />, managerOnly: true },
  ]

  const visibleTabs = tabs.filter(t => !t.managerOnly || data.authState.isManager)

  return (
    <div className="schedule-page__container">
      <div className="schedule-page__header">
        <h1 className="schedule-page__team-name">{data.team.name}</h1>
        <p className="schedule-page__subtitle">Team Schedule</p>
      </div>

      <div className="schedule-page__tabs">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            className={`schedule-page__tab ${activeTab === tab.key ? 'schedule-page__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <WeekSwitcher />

      <div className="schedule-page__content">
        {activeTab === 'availability' && (
          <div className="schedule-page__tab-panel" key={`avail-${calendarKey}`}>
            {data.authState.isManager && viewedCalendar && (
              <ChangesBanner calendar={viewedCalendar} />
            )}
            <AvailabilityVoting />
            <AvailabilityMatrix />
            <WeekScheduleSummary />
          </div>
        )}
        {activeTab === 'calendar' && (
          <div className="schedule-page__tab-panel">
            <CalendarMonth />
            <AbsenceManager />
          </div>
        )}
        {activeTab === 'build' && data.authState.isManager && (
          <div className="schedule-page__tab-panel" key={`build-${calendarKey}`}>
            <BuildTab />
          </div>
        )}
      </div>
    </div>
  )
}
