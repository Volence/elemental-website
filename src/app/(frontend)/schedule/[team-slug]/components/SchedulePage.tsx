'use client'

import React from 'react'
import { Calendar, ClipboardList, Wrench } from 'lucide-react'
import { ScheduleProvider, useSchedule } from '@/components/scheduling/ScheduleContext'
import { AvailabilityVoting } from '@/components/scheduling/AvailabilityVoting'
import { AvailabilityMatrix } from '@/components/scheduling/AvailabilityMatrix'
import type { SchedulePageData, ScheduleTab } from '@/components/scheduling/types'
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

function SchedulePageInner() {
  const { data, activeTab, setActiveTab } = useSchedule()

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

      <div className="schedule-page__content">
        {activeTab === 'availability' && (
          <div className="schedule-page__tab-panel">
            <AvailabilityVoting />
            <AvailabilityMatrix />
          </div>
        )}
        {activeTab === 'calendar' && (
          <div className="schedule-page__tab-panel">
            <p style={{ color: '#94a3b8' }}>Calendar tab - coming in Task 9</p>
          </div>
        )}
        {activeTab === 'build' && data.authState.isManager && (
          <div className="schedule-page__tab-panel">
            <p style={{ color: '#94a3b8' }}>Build tab - coming in Task 11</p>
          </div>
        )}
      </div>
    </div>
  )
}
