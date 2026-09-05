'use client'

import React from 'react'
import { Clapperboard, Mic, Palette, PartyPopper, Search, Smartphone } from 'lucide-react'
import { EXTRA_FLAGS } from '@/access/titles'

interface DepartmentsCellProps {
  rowData?: {
    departments?: Record<string, boolean | null | undefined>
  }
}

// Icon and colour per flag, for the subset EXTRA_FLAGS carries that this cell shows
// (organization/production-only flags like isContentCreator or isPugAdmin are not staff
// "departments" in the sense this column is about, so they are left out here).
const BADGE: Record<string, { icon: React.ReactNode; color: string }> = {
  isProductionStaff: { icon: <Mic size={12} />, color: 'info' },
  isSocialMediaStaff: { icon: <Smartphone size={12} />, color: 'success' },
  isGraphicsStaff: { icon: <Palette size={12} />, color: 'warning' },
  isVideoStaff: { icon: <Clapperboard size={12} />, color: 'error' },
  isEventsStaff: { icon: <PartyPopper size={12} />, color: 'success' },
  isScoutingStaff: { icon: <Search size={12} />, color: 'info' },
}

export default function DepartmentsCell({ rowData }: DepartmentsCellProps) {
  const departments = rowData?.departments

  if (!departments) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>None</span>
  }

  const departmentBadges = EXTRA_FLAGS
    .filter((f) => f.key in BADGE && departments[f.key])
    .map((f) => ({ name: f.label, icon: BADGE[f.key].icon, color: BADGE[f.key].color }))

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

