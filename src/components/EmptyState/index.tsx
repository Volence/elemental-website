'use client'

import React from 'react'
import { Package } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  actionText?: string
  actionHref?: string
}

/**
 * Generic empty state component for collections
 */
const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon = <Package size={32} />,
  title,
  description,
  actionText,
  actionHref
}) => {
  const router = useRouter()

  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        {icon}
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
