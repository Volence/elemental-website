'use client'

import React from 'react'
import { Clapperboard, Mic, Palette, PartyPopper, Search, Smartphone } from 'lucide-react'

interface DepartmentsCellProps {
  rowData?: {
    departments?: {
      isProductionStaff?: boolean
      isSocialMediaStaff?: boolean
      isGraphicsStaff?: boolean
      isVideoStaff?: boolean
      isEventsStaff?: boolean
      isScoutingStaff?: boolean
    }
  }
}

export default function DepartmentsCell({ rowData }: DepartmentsCellProps) {
  const departments = rowData?.departments

  if (!departments) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>None</span>
  }

  const departmentBadges: Array<{ name: string; icon: React.ReactNode; color: string }> = []

  if (departments.isProductionStaff) {
    departmentBadges.push({ name: 'Production', icon: <Mic size={12} />, color: 'info' })
  }

  if (departments.isSocialMediaStaff) {
    departmentBadges.push({ name: 'Social Media', icon: <Smartphone size={12} />, color: 'success' })
  }

  if (departments.isGraphicsStaff) {
    departmentBadges.push({ name: 'Graphics', icon: <Palette size={12} />, color: 'warning' })
  }

  if (departments.isVideoStaff) {
    departmentBadges.push({ name: 'Video', icon: <Clapperboard size={12} />, color: 'error' })
  }

  if (departments.isEventsStaff) {
    departmentBadges.push({ name: 'Events', icon: <PartyPopper size={12} />, color: 'success' })
  }

  if (departments.isScoutingStaff) {
    departmentBadges.push({ name: 'Scouting', icon: <Search size={12} />, color: 'info' })
  }

  if (departmentBadges.length === 0) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>None</span>
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {departmentBadges.map((badge) => (
        <span
          key={badge.name}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: '600',
            background: `rgba(var(--theme-${badge.color}-rgb), 0.1)`,
            color: `var(--theme-${badge.color})`,
            border: `1px solid rgba(var(--theme-${badge.color}-rgb), 0.3)`,
          }}
        >
          {badge.icon} {badge.name}
        </span>
      ))}
    </div>
  )
}

