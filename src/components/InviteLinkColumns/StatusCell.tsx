'use client'

import React from 'react'
import type { InviteLink } from '@/payload-types'

interface StatusCellProps {
  rowData: InviteLink
}

const StatusCell: React.FC<StatusCellProps> = ({ rowData }) => {
  const now = new Date()
  const expiresAt = new Date(rowData.expiresAt)
  const isUsed = !!rowData.usedAt
  const isExpired = expiresAt < now

  let status = 'Active'
  let color = '#10b981' // green
  let bgColor = '#d1fae5'

  if (isUsed) {
    status = 'Used'
    color = '#6b7280' // gray
    bgColor = '#f3f4f6'
  } else if (isExpired) {
    status = 'Expired'
    color = '#ef4444' // red
    bgColor = '#fee2e2'
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontWeight: '500',
        color,
        backgroundColor: bgColor,
      }}
    >
      {status}
    </span>
  )
}

export default StatusCell

