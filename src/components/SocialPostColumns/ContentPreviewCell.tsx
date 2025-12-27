'use client'

import React, { useState } from 'react'

interface ContentPreviewCellProps {
  rowData?: {
    content?: string
  }
}

export default function ContentPreviewCell({ rowData }: ContentPreviewCellProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const content = rowData?.content

  if (!content) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>—</span>
  }

  const previewLength = 60
  const isLong = content.length > previewLength
  const preview = isLong ? content.substring(0, previewLength) + '...' : content

  return (
    <div
      style={{ position: 'relative', maxWidth: '300px' }}
      onMouseEnter={() => isLong && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        style={{
          color: 'var(--theme-elevation-800)',
          fontSize: '0.9rem',
          lineHeight: '1.4',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {preview}
      </div>

      {showTooltip && isLong && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            zIndex: 1000,
            marginTop: '8px',
            padding: '12px',
            background: 'var(--theme-elevation-0)',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxWidth: '400px',
            minWidth: '250px',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            color: 'var(--theme-elevation-900)',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}

