'use client'

import React from 'react'

interface StatusCellProps {
  rowData?: {
    status?: string
  }
}

export default function StatusCell({ rowData }: StatusCellProps) {
  const status = rowData?.status

  if (!status) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>—</span>
  }

  const getStatusClass = (status: string) => {
    const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
      'Draft': { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', border: '#6b728040' },
      'Ready for Review': { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '#f59e0b40' },
      'Approved': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '#10b98140' },
      'Scheduled': { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '#3b82f640' },
      'Posted': { bg: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '#05966940' },
    }

    return statusStyles[status] || statusStyles['Draft']
  }

  const styles = getStatusClass(status)

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.3rem 0.7rem',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: '600',
        backgroundColor: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

