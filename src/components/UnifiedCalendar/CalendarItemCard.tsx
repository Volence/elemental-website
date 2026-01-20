'use client'

import React from 'react'
import Link from 'next/link'
import type { CalendarItem } from './types'
import { getDepartmentColor } from './types'

interface CalendarItemCardProps {
  item: CalendarItem
  compact?: boolean
}

export function CalendarItemCard({ item, compact = false }: CalendarItemCardProps) {
  const color = getDepartmentColor(item.department)
  
  const getTypeIcon = () => {
    switch (item.type) {
      case 'task': return '📋'
      case 'match': return '⚔️'
      case 'social-post': return '📱'
      default: return '📌'
    }
  }

  const getStatusClass = () => {
    const s = item.status?.toLowerCase() || ''
    if (s.includes('complete') || s.includes('posted')) return 'status--complete'
    if (s.includes('progress') || s.includes('scheduled')) return 'status--active'
    if (s.includes('review')) return 'status--review'
    return ''
  }

  const formatTime = () => {
    return item.date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })
  }

  return (
    <Link 
      href={item.href}
      className={`calendar-item-card ${compact ? 'calendar-item-card--compact' : ''}`}
      style={{ '--dept-color': color } as React.CSSProperties}
      title={item.title}
    >
      <div className="calendar-item-card__content">
        <div className="calendar-item-card__top-row">
          <span className="calendar-item-card__icon">{getTypeIcon()}</span>
          <span className="calendar-item-card__time">{formatTime()}</span>
          <span className="calendar-item-card__title">{item.title}</span>
        </div>
        {!compact && item.status && (
          <div className="calendar-item-card__meta">
            <span className="calendar-item-card__department">{item.department}</span>
            <span className={`calendar-item-card__status ${getStatusClass()}`}>
              {item.status}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

