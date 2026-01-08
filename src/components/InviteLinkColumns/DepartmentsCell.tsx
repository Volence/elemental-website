'use client'

import React from 'react'

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

  const departmentBadges: Array<{ name: string; emoji: string; color: string }> = []

  if (departments.isProductionStaff) {
    departmentBadges.push({ name: 'Production', emoji: '🎙️', color: 'info' })
  }

  if (departments.isSocialMediaStaff) {
    departmentBadges.push({ name: 'Social Media', emoji: '📱', color: 'success' })
  }

  if (departments.isGraphicsStaff) {
    departmentBadges.push({ name: 'Graphics', emoji: '🎨', color: 'warning' })
  }

  if (departments.isVideoStaff) {
    departmentBadges.push({ name: 'Video', emoji: '🎬', color: 'error' })
  }

  if (departments.isEventsStaff) {
    departmentBadges.push({ name: 'Events', emoji: '🎉', color: 'success' })
  }

  if (departments.isScoutingStaff) {
    departmentBadges.push({ name: 'Scouting', emoji: '🔍', color: 'info' })
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
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: '600',
            background: `rgba(var(--theme-${badge.color}-rgb), 0.1)`,
            color: `var(--theme-${badge.color})`,
            border: `1px solid rgba(var(--theme-${badge.color}-rgb), 0.3)`,
          }}
        >
          {badge.emoji} {badge.name}
        </span>
      ))}
    </div>
  )
}

