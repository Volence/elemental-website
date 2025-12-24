'use client'

import React from 'react'
import { getTierFromRating } from '@/utilities/tierColors'
import '../AdminSkeletonLoader/styles.scss'

/**
 * Custom cell component to display team rating with tier-based colors
 */
const RatingCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="admin-table-column-skeleton">
        <div className="admin-skeleton" style={{ width: '80%', height: '16px' }} />
      </div>
    )
  }

  const rating = rowData?.rating
  
  if (!rating) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: '50px',
          color: 'var(--theme-text-500)',
          fontSize: '0.875rem',
        }}
      >
        —
      </div>
    )
  }

  const tierColors = getTierFromRating(rating)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '50px',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          fontWeight: '600',
          backgroundColor: `${tierColors.borderColor}15`,
          color: tierColors.borderColor,
          border: `1px solid ${tierColors.borderColor}50`,
        }}
      >
        {rating}
      </span>
    </div>
  )
}

export default RatingCell
