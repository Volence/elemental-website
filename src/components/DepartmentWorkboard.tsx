'use client'

import React, { useEffect } from 'react'
import { useStepNav } from '@payloadcms/ui'
import { KanbanBoard } from './WorkboardKanban'
import './DepartmentWorkboard.scss'
import { Palette, PartyPopper, Video } from 'lucide-react'

/**
 * Department-specific dashboard views that display the Kanban board
 * for each department. These are used as list view replacements for
 * the anchor collections to match the dashboard styling.
 */

function DashboardWrapper({ 
  children, 
  title, 
  groupLabel 
}: { 
  children: React.ReactNode
  title: string
  groupLabel: string
}) {
  const { setStepNav } = useStepNav()
  
  useEffect(() => {
    setStepNav([
      { label: groupLabel },
      { label: title },
    ])
  }, [setStepNav, title, groupLabel])
  
  return (
    <div className="department-workboard">
      <div className="department-workboard__inner">
        <h1 className="department-workboard__title">{title}</h1>
        {children}
      </div>
    </div>
  )
}

export function GraphicsWorkboard() {
  return (
    <DashboardWrapper title="Graphics Dashboard" groupLabel="Graphics">
      <KanbanBoard department="graphics" title="<Palette size={14} /> Graphics Dashboard" />
    </DashboardWrapper>
  )
}

export function VideoWorkboard() {
  return (
    <DashboardWrapper title="Video Dashboard" groupLabel="Video">
      <KanbanBoard department="video" title="<Video size={14} /> Video Dashboard" />
    </DashboardWrapper>
  )
}

export function EventsWorkboard() {
  return (
    <DashboardWrapper title="Events Dashboard" groupLabel="Events">
      <KanbanBoard department="events" title="<PartyPopper size={14} /> Events Dashboard" />
    </DashboardWrapper>
  )
}

export default { GraphicsWorkboard, VideoWorkboard, EventsWorkboard }

