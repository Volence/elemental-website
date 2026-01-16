'use client'

import React from 'react'
import { KanbanBoard } from './WorkboardKanban'
import './DepartmentWorkboard.scss'

/**
 * Department-specific dashboard views that display the Kanban board
 * for each department. These are used as list view replacements for
 * the anchor collections to match the dashboard styling.
 */

function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="department-workboard">
      <div className="department-workboard__inner">
        {children}
      </div>
    </div>
  )
}

export function GraphicsWorkboard() {
  return (
    <DashboardWrapper>
      <KanbanBoard department="graphics" title="🎨 Graphics Dashboard" />
    </DashboardWrapper>
  )
}

export function VideoWorkboard() {
  return (
    <DashboardWrapper>
      <KanbanBoard department="video" title="🎥 Video Dashboard" />
    </DashboardWrapper>
  )
}

export function EventsWorkboard() {
  return (
    <DashboardWrapper>
      <KanbanBoard department="events" title="🎉 Events Dashboard" />
    </DashboardWrapper>
  )
}

export default { GraphicsWorkboard, VideoWorkboard, EventsWorkboard }
