'use client'

import React from 'react'

interface DepartmentsCellProps {
  rowData?: {
    departments?: {
      isProductionStaff?: boolean
    }
  }
}

export default function DepartmentsCell({ rowData }: DepartmentsCellProps) {
  const departments = rowData?.departments

  if (!departments) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>None</span>
  }

  const departmentBadges: string[] = []

  if (departments.isProductionStaff) {
    departmentBadges.push('Production')
  }

  if (departmentBadges.length === 0) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>None</span>
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {departmentBadges.map((badge) => (
        <span
          key={badge}
          style={{
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: '600',
            background: 'rgba(var(--theme-info-rgb), 0.1)',
            color: 'var(--theme-info)',
            border: '1px solid rgba(var(--theme-info-rgb), 0.3)',
          }}
        >
          🎙️ {badge}
        </span>
      ))}
    </div>
  )
}

