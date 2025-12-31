'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface EmptyStateProps {
  emoji?: string
  title: string
  description: string
  actionText?: string
  actionHref?: string
}

/**
 * Generic empty state component for collections
 */
const EmptyState: React.FC<EmptyStateProps> = ({ 
  emoji = '📦',
  title,
  description,
  actionText,
  actionHref
}) => {
  const router = useRouter()

  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        {emoji}
      </div>
      <h3 className="empty-state__title">
        {title}
      </h3>
      <p className="empty-state__description">
        {description}
      </p>
      {actionText && actionHref && (
        <button
          onClick={() => router.push(actionHref)}
          className="empty-state__action"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}

export default EmptyState
