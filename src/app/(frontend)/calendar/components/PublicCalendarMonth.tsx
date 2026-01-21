'use client'

import React, { useState, useMemo, useEffect } from 'react'
import type { GlobalCalendarEvent } from '@/payload-types'

// Event type colors - using raw color values for inline styles (Tailwind can't detect dynamic classes)
const EVENT_TYPE_COLORS: Record<string, { 
  borderColor: string; 
  textColor: string; 
  bgColor: string; 
  hoverBgColor: string;
  lineColor: string; 
  glowColor: string;
}> = {
  'faceit': { borderColor: '#f97316', textColor: '#fb923c', bgColor: 'rgba(124, 45, 18, 0.4)', hoverBgColor: 'rgba(124, 45, 18, 0.65)', lineColor: '#f97316', glowColor: 'rgba(249, 115, 22, 0.3)' },
  'owcs': { borderColor: '#3b82f6', textColor: '#60a5fa', bgColor: 'rgba(30, 58, 138, 0.4)', hoverBgColor: 'rgba(30, 58, 138, 0.65)', lineColor: '#3b82f6', glowColor: 'rgba(59, 130, 246, 0.3)' },
  'community': { borderColor: '#22c55e', textColor: '#4ade80', bgColor: 'rgba(20, 83, 45, 0.4)', hoverBgColor: 'rgba(20, 83, 45, 0.65)', lineColor: '#22c55e', glowColor: 'rgba(34, 197, 94, 0.3)' },
  'internal': { borderColor: '#a855f7', textColor: '#c084fc', bgColor: 'rgba(59, 7, 100, 0.4)', hoverBgColor: 'rgba(59, 7, 100, 0.65)', lineColor: '#a855f7', glowColor: 'rgba(168, 85, 247, 0.3)' },
  'match': { borderColor: '#f43f5e', textColor: '#fb7185', bgColor: 'rgba(136, 19, 55, 0.4)', hoverBgColor: 'rgba(136, 19, 55, 0.65)', lineColor: '#f43f5e', glowColor: 'rgba(244, 63, 94, 0.3)' },
}

interface PublicCalendarMonthProps {
  events: GlobalCalendarEvent[]
}

export function PublicCalendarMonth({ events }: PublicCalendarMonthProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isMounted, setIsMounted] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<GlobalCalendarEvent | null>(null)
  const [hoveredEventId, setHoveredEventId] = useState<string | number | null>(null)
  
  // Wait for client-side mount to avoid hydration mismatch from timezone differences
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Build weeks for the calendar
  const weeks = useMemo(() => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startDayOfWeek = firstDayOfMonth.getDay()
    
    const calendarStartDate = new Date(firstDayOfMonth)
    calendarStartDate.setDate(firstDayOfMonth.getDate() - startDayOfWeek)
    
    const weeksArray: Date[][] = []
    for (let w = 0; w < 6; w++) {
      const weekDays: Date[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(calendarStartDate)
        date.setDate(calendarStartDate.getDate() + (w * 7) + d)
        weekDays.push(date)
      }
      weeksArray.push(weekDays)
    }
    
    return weeksArray
  }, [currentDate])

  // Get spanning events for a week (clipped to current month only)
  const getSpanningEventsForWeek = (weekDays: Date[]) => {
    const weekStart = new Date(weekDays[0])
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekDays[6])
    weekEnd.setHours(23, 59, 59, 999)
    
    const currentMonth = currentDate.getMonth()

    return events.filter(event => {
      const eventStart = new Date(event.dateStart)
      const eventEnd = event.dateEnd ? new Date(event.dateEnd) : eventStart
      eventStart.setHours(0, 0, 0, 0)
      eventEnd.setHours(23, 59, 59, 999)
      
      // Event overlaps with this week
      return eventStart <= weekEnd && eventEnd >= weekStart
    }).map(event => {
      const eventStart = new Date(event.dateStart)
      const eventEnd = event.dateEnd ? new Date(event.dateEnd) : eventStart
      eventStart.setHours(0, 0, 0, 0)
      eventEnd.setHours(23, 59, 59, 999)

      // Find the first and last day indices that are IN the current month
      let firstMonthDayIdx = -1
      let lastMonthDayIdx = -1
      for (let i = 0; i < 7; i++) {
        if (weekDays[i].getMonth() === currentMonth) {
          if (firstMonthDayIdx === -1) firstMonthDayIdx = i
          lastMonthDayIdx = i
        }
      }

      // If no days in this week are in the current month, skip
      if (firstMonthDayIdx === -1) return null

      // Calculate position within this week
      let startIdx = firstMonthDayIdx
      let endIdx = lastMonthDayIdx

      for (let i = 0; i < 7; i++) {
        const day = weekDays[i]
        if (day.getMonth() !== currentMonth) continue // Skip days not in current month
        
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        if (eventStart <= dayEnd && eventStart >= dayStart) {
          startIdx = i
        }
        if (eventEnd >= dayStart && eventEnd <= dayEnd) {
          endIdx = i
        }
      }

      // Clamp to current month boundaries within this week
      if (eventStart < weekStart || weekDays[startIdx].getMonth() !== currentMonth) {
        startIdx = firstMonthDayIdx
      }
      if (eventEnd > weekEnd || weekDays[endIdx].getMonth() !== currentMonth) {
        endIdx = lastMonthDayIdx
      }

      // Final check: both indices must be in current month
      if (weekDays[startIdx].getMonth() !== currentMonth) return null
      if (weekDays[endIdx].getMonth() !== currentMonth) return null

      // Check if this is the first week segment (event starts in this week or before)
      const isFirstSegment = eventStart >= weekStart && eventStart <= weekEnd
      // Check if this is the last week segment (event ends in this week)
      const isLastSegment = eventEnd >= weekStart && eventEnd <= weekEnd

      return {
        event,
        startIdx,
        endIdx,
        span: endIdx - startIdx + 1,
        isFirstSegment,
        isLastSegment,
      }
    }).filter(Boolean) as Array<{ event: GlobalCalendarEvent; startIdx: number; endIdx: number; span: number; isFirstSegment: boolean; isLastSegment: boolean }>
  }

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date()

  // Show loading skeleton during SSR/hydration to prevent mismatch
  if (!isMounted) {
    return (
      <div className="public-calendar-month mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-gray-800 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="rounded-lg border border-gray-800 overflow-hidden bg-gray-900/50 h-80 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="public-calendar-month mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">{monthYear}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToNextMonth}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border border-gray-800 overflow-hidden bg-gray-900/50 backdrop-blur-sm">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-800/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-gray-400 uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Week Rows */}
        {weeks.map((weekDays, weekIndex) => {
          const spanningEvents = getSpanningEventsForWeek(weekDays)
          
          return (
            <div key={weekIndex} className="border-t border-gray-800">
              {/* Date Numbers Row */}
              <div className="grid grid-cols-7">
                {weekDays.map((date, dayIndex) => {
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                  const isToday = date.toDateString() === today.toDateString()
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`
                        py-1 px-1.5 text-sm font-medium border-r border-gray-800 last:border-r-0
                        ${isCurrentMonth ? '' : 'opacity-40'}
                        ${isToday ? 'bg-yellow-500/10' : ''}
                      `}
                    >
                      <span className={isToday ? 'text-yellow-400' : 'text-gray-300'}>
                        {date.getDate()}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Spanning Bars Container */}
              <div className="relative min-h-[28px] px-0.5">
                {(() => {
                  // Slot allocation: assign each event to the lowest available row
                  // Track which slots are occupied for each day column (0-6)
                  const daySlots: number[][] = Array.from({ length: 7 }, () => [])
                  
                  const eventsWithSlots = spanningEvents.map(({ event, startIdx, endIdx, span, isFirstSegment }) => {
                    // Find the first slot that's available for all days this event spans
                    let slot = 0
                    while (true) {
                      let slotAvailable = true
                      for (let d = startIdx; d <= endIdx; d++) {
                        if (daySlots[d].includes(slot)) {
                          slotAvailable = false
                          break
                        }
                      }
                      if (slotAvailable) break
                      slot++
                    }
                    
                    // Mark this slot as occupied for all spanned days
                    for (let d = startIdx; d <= endIdx; d++) {
                      daySlots[d].push(slot)
                    }
                    
                    return { event, startIdx, endIdx, span, slot, isFirstSegment }
                  })
                  
                  const maxSlot = eventsWithSlots.reduce((max, e) => Math.max(max, e.slot), -1)
                  
                  return (
                    <>
                      {eventsWithSlots.map(({ event, startIdx, endIdx, span, slot, isFirstSegment }) => {
                        const colors = EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS['internal']
                        const leftPercent = (startIdx / 7) * 100
                        const widthPercent = (span / 7) * 100
                        const isMultiDay = event.dateEnd && new Date(event.dateEnd).getTime() !== new Date(event.dateStart).getTime()
                        const isHovered = hoveredEventId === event.id
                        
                        // Single-day events: show clean glow card style
                        if (!isMultiDay) {
                          return (
                            <div
                              key={event.id}
                              className="absolute h-5 rounded text-[10px] font-medium px-1.5 truncate flex items-center cursor-pointer transition-all duration-150"
                              style={{
                                left: `${leftPercent}%`,
                                width: `calc(${widthPercent}% - 4px)`,
                                top: `${slot * 22 + 2}px`,
                                borderLeft: `2px solid ${colors.borderColor}`,
                                backgroundColor: isHovered ? colors.hoverBgColor : colors.bgColor,
                                color: colors.textColor,
                                boxShadow: isHovered 
                                  ? `0 4px 12px -1px ${colors.glowColor}` 
                                  : `0 4px 6px -1px ${colors.glowColor}`,
                              }}
                              title={`${event.title}\n${new Date(event.dateStart).toLocaleDateString()}`}
                              onClick={() => setSelectedEvent(event)}
                              onMouseEnter={() => setHoveredEventId(event.id)}
                              onMouseLeave={() => setHoveredEventId(null)}
                            >
                              {event.title}
                            </div>
                          )
                        }
                        
                        // Multi-day events: show title label + extending line
                        return (
                          <div 
                            key={`${event.id}-${startIdx}`}
                            className="absolute flex items-center cursor-pointer"
                            style={{
                              left: `${leftPercent}%`,
                              width: `calc(${widthPercent}% - 4px)`,
                              top: `${slot * 22 + 2}px`,
                              height: '20px',
                            }}
                            title={`${event.title}\n${new Date(event.dateStart).toLocaleDateString()} - ${new Date(event.dateEnd!).toLocaleDateString()}`}
                            onClick={() => setSelectedEvent(event)}
                            onMouseEnter={() => setHoveredEventId(event.id)}
                            onMouseLeave={() => setHoveredEventId(null)}
                          >
                            {/* Title label - shown at start of each week row */}
                            <div 
                              className="h-5 rounded text-[10px] font-medium px-1.5 truncate flex items-center transition-all duration-150 whitespace-nowrap shrink-0"
                              style={{ 
                                maxWidth: '150px',
                                borderLeft: `2px solid ${colors.borderColor}`,
                                backgroundColor: isHovered ? colors.hoverBgColor : colors.bgColor,
                                color: colors.textColor,
                                boxShadow: isHovered 
                                  ? `0 4px 12px -1px ${colors.glowColor}` 
                                  : `0 4px 6px -1px ${colors.glowColor}`,
                              }}
                            >
                              {event.title}
                            </div>
                            {/* Soft colored bar extending across the span */}
                            <div 
                              className="rounded transition-all duration-150"
                              style={{ 
                                flex: 1, 
                                height: '4px',
                                backgroundColor: isHovered ? colors.hoverBgColor : colors.bgColor,
                                marginLeft: '4px',
                              }}
                            />
                          </div>
                        )
                      })}
                      {/* Spacer to account for stacked events */}
                      {maxSlot >= 0 && (
                        <div style={{ height: `${(maxSlot + 1) * 22 + 4}px` }} />
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span>FACEIT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>OWCS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Community</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>Internal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-rose-500" />
          <span>Match</span>
        </div>
      </div>

      {/* Event Details Modal - Clean Glow Style */}
      {selectedEvent && (() => {
        const colors = EVENT_TYPE_COLORS[selectedEvent.eventType] || EVENT_TYPE_COLORS['internal']
        return (
          <div 
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedEvent(null)}
          >
            {/* Modal container with solid black base + colored border glow */}
            <div 
              className="rounded-lg overflow-hidden relative"
              style={{ 
                maxWidth: '384px', 
                width: '100%',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${colors.borderColor}40`,
                boxShadow: `0 0 30px ${colors.glowColor}, 0 0 60px ${colors.glowColor}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Colored overlay for subtle tint effect */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{ 
                  background: `linear-gradient(135deg, ${colors.bgColor} 0%, transparent 60%)`,
                }}
              />
              
              {/* Header - with transparent color background */}
              <div 
                className="relative px-5 py-4"
                style={{ 
                  borderLeft: `3px solid ${colors.borderColor}`,
                  backgroundColor: colors.bgColor,
                }}
              >
                <h3 
                  className="text-lg font-semibold"
                  style={{ color: colors.textColor }}
                >
                  {selectedEvent.title}
                </h3>
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {selectedEvent.eventType}
                </span>
              </div>
              
              {/* Content */}
              <div className="relative px-5 py-4 space-y-3 border-t border-gray-800/50">
                {/* Dates */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">📅</span>
                  <span className="text-gray-300">
                    {new Date(selectedEvent.dateStart).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                    {selectedEvent.dateEnd && new Date(selectedEvent.dateEnd).getTime() !== new Date(selectedEvent.dateStart).getTime() && (
                      <> — {new Date(selectedEvent.dateEnd).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}</>
                    )}
                  </span>
                </div>
                
                {/* Description - if available */}
                {selectedEvent.description && (
                  <div className="text-sm text-gray-400">
                    <p>{typeof selectedEvent.description === 'string' ? selectedEvent.description : 'Event details available in admin.'}</p>
                  </div>
                )}
                
                {/* Region - if available */}
                {selectedEvent.region && selectedEvent.region !== 'global' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">🌍</span>
                    <span className="text-gray-300 uppercase">{selectedEvent.region}</span>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="relative px-5 py-3 flex justify-end border-t border-gray-800/50">
                <button 
                  className="px-4 py-2 text-sm rounded transition-colors"
                  style={{ 
                    color: colors.textColor,
                    backgroundColor: colors.bgColor,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hoverBgColor}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bgColor}
                  onClick={() => setSelectedEvent(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
