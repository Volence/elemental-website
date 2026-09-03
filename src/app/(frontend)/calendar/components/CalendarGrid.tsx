'use client'

import React, { useState, useEffect } from 'react'
import type { GlobalCalendarEvent } from '@/payload-types'

// Event type styling
const EVENT_TYPE_CONFIG: Record<string, { emoji: string; color: string; bgColor: string }> = {
  'faceit': { emoji: '🏆', color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/30' },
  'owcs': { emoji: '⚔️', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30' },
  'community': { emoji: '🎉', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/30' },
  'internal': { emoji: '🏠', color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/30' },
  'match': { emoji: '📺', color: 'text-rose-400', bgColor: 'bg-rose-500/10 border-rose-500/30' },
}

const INTERNAL_TYPE_EMOJI: Record<string, string> = {
  'seminar': '🎓',
  'pugs': '🎮',
  'internal-tournament': '🏅',
  'other': '📋',
}

interface CalendarGridProps {
  events: GlobalCalendarEvent[]
}

export function CalendarGrid({ events }: CalendarGridProps) {
  const [isMounted, setIsMounted] = useState(false)
  
  // Wait for client-side mount to avoid hydration mismatch from date formatting
  useEffect(() => {
    setIsMounted(true)
  }, [])
  // Group events by month
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.dateStart)
    const monthKey = date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    
    if (!acc[monthKey]) {
      acc[monthKey] = []
    }
    acc[monthKey].push(event)
    return acc
  }, {} as Record<string, GlobalCalendarEvent[]>)
  
  // Show loading skeleton during SSR/hydration to prevent mismatch
  if (!isMounted) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-border p-4 h-32 animate-pulse bg-card/50" />
          ))}
        </div>
      </div>
    )
  }
  
  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📅</div>
        <h2 className="text-xl font-medium text-foreground/90 mb-2">No Upcoming Events</h2>
        <p className="text-muted-foreground">Check back soon for new events and tournaments.</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-8">
      {Object.entries(groupedEvents).map(([month, monthEvents]) => (
        <div key={month}>
          {/* Month Header */}
          <h2 className="text-lg font-semibold text-foreground/90 mb-4 pb-2 border-b border-border">
            {month}
          </h2>
          
          {/* Events Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {monthEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EventCard({ event }: { event: GlobalCalendarEvent }) {
  const config = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG['internal']
  
  // Get appropriate emoji
  let emoji = config.emoji
  if (event.eventType === 'internal' && event.internalEventType) {
    emoji = INTERNAL_TYPE_EMOJI[event.internalEventType] || emoji
  }
  
  // Format dates
  const startDate = new Date(event.dateStart)
  const endDate = event.dateEnd ? new Date(event.dateEnd) : null
  
  const dateDisplay = formatDateDisplay(startDate, endDate)
  
  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} backdrop-blur-sm transition-all hover:scale-[1.02]`}>
      <div className="flex items-start gap-3">
        {/* Emoji Icon */}
        <div className="text-2xl">{emoji}</div>
        
        <div className="flex-1 min-w-0">
          {/* Title and Region */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-semibold ${config.color}`}>{event.title}</h3>
            {event.region && event.region !== 'global' && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-muted/50 text-foreground/90 rounded">
                {event.region}
              </span>
            )}
          </div>
          
          {/* Date */}
          <p className="text-sm text-muted-foreground mt-1">
            📆 {dateDisplay}
          </p>
          
          {/* Description */}
          {event.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
          )}
          
          {/* Links */}
          {event.links && event.links.length > 0 && (
            <div className="flex gap-3 mt-3 flex-wrap">
              {event.links.map((link, index) => (
                link.url && link.label && (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-yellow-400 hover:text-yellow-300 hover:underline transition-colors"
                  >
                    🔗 {link.label}
                  </a>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDateDisplay(start: Date, end: Date | null): string {
  const startStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  
  // Add time if not midnight (implies a specific time was set)
  const hasTime = start.getHours() !== 0 || start.getMinutes() !== 0
  const timeStr = hasTime ? ` at ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''
  
  if (!end) {
    return startStr + timeStr
  }
  
  // Check if same day
  if (start.toDateString() === end.toDateString()) {
    const endTimeStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${startStr}${timeStr} - ${endTimeStr}`
  }
  
  // Different days - show date range
  const endStr = end.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  
  return `${startStr} - ${endStr}`
}
