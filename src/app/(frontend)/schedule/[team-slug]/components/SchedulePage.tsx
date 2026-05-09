'use client'

import React from 'react'
import { Calendar, ClipboardList, Wrench, ChevronLeft, ChevronRight } from 'lucide-react'
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
            {data.authState.isManager && viewedCalendar && (() => {
              const lastBuilt = (viewedCalendar as any).schedule?.lastUpdated
              if (!lastBuilt) return null
              const newCount = ((viewedCalendar as any).responses || []).filter(
                (r: any) => r.respondedAt && new Date(r.respondedAt) > new Date(lastBuilt)
              ).length
              if (newCount === 0) return null
              return (
                <div className="schedule-page__changes-banner">
                  <span className="schedule-page__changes-dot" />
                  {newCount} new response{newCount !== 1 ? 's' : ''} since last build
                </div>
              )
            })()}
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
