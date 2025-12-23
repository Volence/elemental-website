'use client'

import React from 'react'
import type { RecruitmentListing } from '@/payload-types'

interface RoleCellProps {
  rowData?: RecruitmentListing
}

const roleLabels: Record<string, string> = {
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
}

export const RoleCell: React.FC<RoleCellProps> = ({ rowData }) => {
  if (!rowData?.role) return <span className="list-cell-empty">—</span>

  const label = roleLabels[rowData.role] || rowData.role

  return (
    <div className="list-cell">
      <span className="list-cell-tag list-cell-tag--role">{label}</span>
    </div>
  )
}

export default RoleCell

