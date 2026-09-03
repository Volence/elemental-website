'use client'

import React from 'react'
import type { CalendarItem } from './types'
import { getDepartmentColor } from './types'
import { ClipboardList, Pin, Smartphone, Swords } from 'lucide-react'

interface CalendarItemCardProps {
  item: CalendarItem
  compact?: boolean
  /** Opens the shared detail modal. Every item, single or multi-day, uses the same path. */
  onSelect: (item: CalendarItem) => void
}

export function CalendarItemCard({ item, compact = false, onSelect }: CalendarItemCardProps) {
  const color = getDepartmentColor(item.department)

  const getTypeIcon = (): React.ReactNode => {
    switch (item.type) {
      case 'task':
        return item.meta?.postType ? <Smartphone size={12} /> : <ClipboardList size={14} />
      case 'match':
        return <Swords size={14} />
      case 'social-post':
        return <Smartphone size={12} />
      default:
        return <Pin size={14} />
    }
  }

  const getStatusClass = () => {
    const s = item.status?.toLowerCase() || ''
    if (s.includes('complete') || s.includes('posted')) return 'status--complete'
    if (s.includes('progress') || s.includes('scheduled')) return 'status--active'
    if (s.includes('review')) return 'status--review'
    return ''
  }

  const time = item.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`calendar-item-card ${compact ? 'calendar-item-card--compact' : ''}`}
      style={{ '--dept-color': color } as React.CSSProperties}
      title={item.title}
    >
      <div className="calendar-item-card__content">
        <div className="calendar-item-card__top-row">
          <span className="calendar-item-card__icon">{getTypeIcon()}</span>
          <span className="calendar-item-card__time">{time}</span>
          <span className="calendar-item-card__title">{item.title}</span>
        </div>
        {!compact && item.status && (
          <div className="calendar-item-card__meta">
            <span className="calendar-item-card__department">{item.department}</span>
            <span className={`calendar-item-card__status ${getStatusClass()}`}>{item.status}</span>
          </div>
        )}
      </div>
    </button>
  )
}
