'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { Department, CalendarItem } from './types'
import { DEPARTMENTS, getDepartmentColor, getDepartmentColors } from './types'
import { useUnifiedCalendarData } from './useUnifiedCalendarData'
import { DepartmentFilterBar } from './DepartmentFilterBar'
import { CalendarItemCard } from './CalendarItemCard'
import type { User } from '@/payload-types'
import './UnifiedCalendar.scss'

const STORAGE_KEY = 'unifiedCalendar_enabledDepartments'

// Helper to get user's departments from their department flags
function getUserDepartments(user: User | null | undefined): Department[] {
  if (!user?.departments) return []
  
  const deps: Department[] = []
  if (user.departments.isGraphicsStaff) deps.push('graphics')
  if (user.departments.isVideoStaff) deps.push('video')
  if (user.departments.isEventsStaff) deps.push('events')
  if (user.departments.isScoutingStaff) deps.push('scouting')
  if (user.departments.isProductionStaff) deps.push('production')
  if (user.departments.isSocialMediaStaff) deps.push('social-media')
  
  return deps
}

export default function UnifiedCalendarView() {
  const { user } = useAuth<User>()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasLoadedDefaults, setHasLoadedDefaults] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarItem | null>(null)
  
  // Initialize with all departments so data loads immediately on first render
  const [enabledDepartments, setEnabledDepartments] = useState<Department[]>(
    () => DEPARTMENTS.map(d => d.value)
  )
  
  // Determine default departments based on user role
  const defaultDepartments = useMemo(() => {
    // If user hasn't loaded yet, return null to indicate we should wait
    if (!user) return null
    
    // Admins and staff managers see all departments by default
    if (user.role === 'admin' || user.role === 'staff-manager') {
      return DEPARTMENTS.map(d => d.value)
    }
    // For other users, default to their assigned departments
    const userDeps = getUserDepartments(user)
    // If user has no departments, show all (they can toggle as needed)
    return userDeps.length > 0 ? userDeps : DEPARTMENTS.map(d => d.value)
  }, [user])

  // Load saved preferences from localStorage OR apply user defaults
  useEffect(() => {
    // Don't run if we've already loaded defaults
    if (hasLoadedDefaults) return
    
    // First, check localStorage for saved preferences
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Department[]
        if (parsed.length > 0) {
          setEnabledDepartments(parsed)
          setIsInitialized(true)
          setHasLoadedDefaults(true)
          return
        }
      } catch {
        // Fall through to default
      }
    }
    
    // No localStorage preference - wait for user to load before setting defaults
    if (defaultDepartments !== null) {
      setEnabledDepartments(defaultDepartments)
      setIsInitialized(true)
      setHasLoadedDefaults(true)
    }
  }, [defaultDepartments, hasLoadedDefaults])

  // Save filter preferences
  useEffect(() => {
    if (enabledDepartments.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledDepartments))
    }
  }, [enabledDepartments])

  const getStartDate = () => {
    if (viewMode === 'week') {
      const start = new Date(currentDate)
      start.setDate(currentDate.getDate() - currentDate.getDay())
      start.setHours(0, 0, 0, 0)
      return start
    } else {
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    }
  }

  const getEndDate = () => {
    if (viewMode === 'week') {
      const end = new Date(currentDate)
      end.setDate(currentDate.getDate() + (6 - currentDate.getDay()))
      end.setHours(23, 59, 59, 999)
      return end
    } else {
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      return end
    }
  }

  const { items, loading, error } = useUnifiedCalendarData({
    startDate: getStartDate(),
    endDate: getEndDate(),
    departments: enabledDepartments,
  })

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate)
      newDate.setDate(currentDate.getDate() - 7)
      setCurrentDate(newDate)
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }
  }

  const navigateNext = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate)
      newDate.setDate(currentDate.getDate() + 7)
      setCurrentDate(newDate)
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
  }

  // Helper to check if an event is a "spanning" multi-day event (spans 2+ days)
  const isSpanningEvent = (item: CalendarItem): boolean => {
    if (!item.dateEnd) return false
    const startDay = new Date(item.date)
    startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(item.dateEnd)
    endDay.setHours(0, 0, 0, 0)
    // Event spans 2+ days if end is at least 1 day after start
    return endDay.getTime() > startDay.getTime()
  }

  // Get spanning events that overlap with the view range
  const getSpanningEvents = (viewDays: Date[]) => {
    if (viewDays.length === 0) return []
    const viewStart = new Date(viewDays[0])
    viewStart.setHours(0, 0, 0, 0)
    const viewEnd = new Date(viewDays[viewDays.length - 1])
    viewEnd.setHours(23, 59, 59, 999)

    return items.filter(item => {
      if (!isSpanningEvent(item)) return false
      // Check if event overlaps with view range
      return item.date <= viewEnd && item.dateEnd! >= viewStart
    })
  }

  // Calculate the visual position of a spanning event bar
  const getSpanningBarPosition = (item: CalendarItem, viewDays: Date[], currentMonth?: number) => {
    if (viewDays.length === 0) return null
    
    const viewStart = new Date(viewDays[0])
    viewStart.setHours(0, 0, 0, 0)
    const viewEnd = new Date(viewDays[viewDays.length - 1])
    viewEnd.setHours(23, 59, 59, 999)

    // If currentMonth is provided, find the first/last day indices in that month
    let firstMonthDayIdx = 0
    let lastMonthDayIdx = viewDays.length - 1
    
    if (currentMonth !== undefined) {
      firstMonthDayIdx = -1
      lastMonthDayIdx = -1
      for (let i = 0; i < viewDays.length; i++) {
        if (viewDays[i].getMonth() === currentMonth) {
          if (firstMonthDayIdx === -1) firstMonthDayIdx = i
          lastMonthDayIdx = i
        }
      }
      // If no days in this week are in the current month, skip
      if (firstMonthDayIdx === -1) return null
    }

    // Clamp event dates to view range
    const eventStart = new Date(item.date)
    eventStart.setHours(0, 0, 0, 0)
    const eventEnd = new Date(item.dateEnd!)
    eventEnd.setHours(23, 59, 59, 999)

    let startIndex = viewDays.findIndex(d => {
      const day = new Date(d)
      day.setHours(0, 0, 0, 0)
      return day.getTime() >= eventStart.getTime()
    })

    let endIndex = viewDays.length - 1
    for (let i = viewDays.length - 1; i >= 0; i--) {
      const day = new Date(viewDays[i])
      day.setHours(0, 0, 0, 0)
      if (day.getTime() <= eventEnd.getTime()) {
        endIndex = i
        break
      }
    }

    // Adjust for events that start before the view
    const clampedStartIndex = Math.max(0, startIndex === -1 ? 0 : startIndex)
    const startsBeforeView = eventStart < viewStart
    const endsAfterView = eventEnd > viewEnd

    // If currentMonth is provided, clamp to month boundaries
    let finalStartIndex = clampedStartIndex
    let finalEndIndex = endIndex
    
    if (currentMonth !== undefined) {
      // Clamp start to first day in current month
      if (finalStartIndex < firstMonthDayIdx) {
        finalStartIndex = firstMonthDayIdx
      }
      // Clamp end to last day in current month
      if (finalEndIndex > lastMonthDayIdx) {
        finalEndIndex = lastMonthDayIdx
      }
      // If both indices are outside current month, skip
      if (viewDays[finalStartIndex].getMonth() !== currentMonth) return null
      if (viewDays[finalEndIndex].getMonth() !== currentMonth) return null
    }

    return {
      startIndex: finalStartIndex,
      endIndex: finalEndIndex,
      span: finalEndIndex - finalStartIndex + 1,
      startsBeforeView,
      endsAfterView,
    }
  }

  // Get single-day items for a specific day (excludes spanning events)
  const getItemsForDay = (date: Date) => {
    const dateStr = date.toDateString()
    return items.filter(item => {
      // Skip spanning multi-day events (they render as bars)
      if (isSpanningEvent(item)) return false
      // Only include if date matches start date
      return item.date.toDateString() === dateStr
    })
  }

  // Render spanning bars for week view - Clean Glow Style
  const renderSpanningBars = (viewDays: Date[], columnCount: number) => {
    const spanningEvents = getSpanningEvents(viewDays)
    if (spanningEvents.length === 0) return null

    return (
      <div className="unified-calendar__spanning-bars">
        {spanningEvents.map(item => {
          const pos = getSpanningBarPosition(item, viewDays)
          if (!pos) return null

          const colors = getDepartmentColors(item.department)
          const widthPercent = (pos.span / columnCount) * 100
          const leftPercent = (pos.startIndex / columnCount) * 100

          return (
            <button
              type="button"
              key={`spanning-${item.type}-${item.id}`}
              onClick={() => setSelectedEvent(item)}
              className="unified-calendar__spanning-bar"
              style={{
                '--dept-color': colors.primary,
                '--dept-bg': colors.bg,
                '--dept-bg-hover': colors.bgHover,
                '--dept-text': colors.text,
                '--dept-glow': colors.glow,
                '--bar-width': `${widthPercent}%`,
                '--bar-left': `${leftPercent}%`,
              } as React.CSSProperties}
              title={`${item.title}\n${item.date.toLocaleDateString()} - ${item.dateEnd?.toLocaleDateString()}`}
            >
              <span className="unified-calendar__spanning-label">
                {pos.startsBeforeView && <span className="unified-calendar__spanning-arrow">◀</span>}
                <span className="unified-calendar__spanning-title">{item.title}</span>
              </span>
              <span className="unified-calendar__spanning-line" />
              {pos.endsAfterView && <span className="unified-calendar__spanning-arrow">▶</span>}
            </button>
          )
        })}
      </div>
    )
  }

  // Modal for event details
  const renderEventModal = () => {
    if (!selectedEvent) return null

    const color = getDepartmentColor(selectedEvent.department)
    const dateRange = selectedEvent.dateEnd 
      ? `${selectedEvent.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} - ${selectedEvent.dateEnd.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
      : selectedEvent.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    return (
      <div className="unified-calendar__modal-overlay" onClick={() => setSelectedEvent(null)}>
        <div className="unified-calendar__modal" onClick={e => e.stopPropagation()}>
          <button 
            type="button" 
            className="unified-calendar__modal-close"
            onClick={() => setSelectedEvent(null)}
          >
            ✕
          </button>
          <div className="unified-calendar__modal-header" style={{ borderColor: color }}>
            <h3>{selectedEvent.title}</h3>
            <span className="unified-calendar__modal-dept" style={{ color }}>
              {selectedEvent.department}
            </span>
          </div>
          <div className="unified-calendar__modal-body">
            <div className="unified-calendar__modal-row">
              <span className="unified-calendar__modal-label">📅 Date</span>
              <span>{dateRange}</span>
            </div>
            {typeof selectedEvent.meta?.region === 'string' && (
              <div className="unified-calendar__modal-row">
                <span className="unified-calendar__modal-label">🌍 Region</span>
                <span>{selectedEvent.meta.region}</span>
              </div>
            )}
            {typeof selectedEvent.meta?.description === 'string' && selectedEvent.meta.description && (
              <div className="unified-calendar__modal-description">
                <span className="unified-calendar__modal-label">📝 Details</span>
                <p>{selectedEvent.meta.description}</p>
              </div>
            )}
            {Array.isArray(selectedEvent.meta?.links) && selectedEvent.meta.links.length > 0 && (
              <div className="unified-calendar__modal-links">
                <span className="unified-calendar__modal-label">🔗 Links</span>
                <div className="unified-calendar__modal-link-buttons">
                  {(selectedEvent.meta.links as Array<{ label?: string; url?: string }>).map((link, idx) => (
                    link.url && (
                      <a 
                        key={idx} 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="unified-calendar__modal-link"
                      >
                        {link.label || 'Link'}
                      </a>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="unified-calendar__modal-actions">
            <a href={selectedEvent.href} className="btn btn--primary">
              Go to Event Page →
            </a>
            <button 
              type="button" 
              className="btn btn--secondary"
              onClick={() => setSelectedEvent(null)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const days: Date[] = []
    const startDate = getStartDate()

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      days.push(date)
    }

    return (
      <div className="unified-calendar__week-container">
        {/* Date headers row */}
        <div className="unified-calendar__week-headers">
          {days.map((date, index) => {
            const isToday = date.toDateString() === new Date().toDateString()
            const dayItems = getItemsForDay(date)
            return (
              <div 
                key={index} 
                className={`unified-calendar__week-header ${isToday ? 'unified-calendar__week-header--today' : ''}`}
              >
                <div className="unified-calendar__day-date">
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="unified-calendar__day-count">
                  {dayItems.length} item{dayItems.length !== 1 ? 's' : ''}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Spanning bars row (under headers) */}
        {renderSpanningBars(days, 7)}
        
        {/* Day content columns */}
        <div className="unified-calendar__week">
          {days.map((date, index) => {
            const dayItems = getItemsForDay(date)
            const isToday = date.toDateString() === new Date().toDateString()
            
            return (
              <div 
                key={index} 
                className={`unified-calendar__day ${isToday ? 'unified-calendar__day--today' : ''}`}
              >
                <div className="unified-calendar__day-items">
                  {dayItems.length === 0 ? (
                    <div className="unified-calendar__empty">No items</div>
                  ) : (
                    dayItems.map(item => (
                      <CalendarItemCard key={`${item.type}-${item.id}`} item={item} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startDayOfWeek = firstDayOfMonth.getDay()
    
    const calendarStartDate = new Date(firstDayOfMonth)
    calendarStartDate.setDate(firstDayOfMonth.getDate() - startDayOfWeek)
    
    // Build 6 weeks (rows) of days
    const weeks: Date[][] = []
    for (let w = 0; w < 6; w++) {
      const weekDays: Date[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(calendarStartDate)
        date.setDate(calendarStartDate.getDate() + (w * 7) + d)
        weekDays.push(date)
      }
      weeks.push(weekDays)
    }

    // Render spanning bar for a single week row - Clean Glow Style
    const renderWeekSpanningBars = (weekDays: Date[]) => {
      const spanningEvents = getSpanningEvents(weekDays)
      if (spanningEvents.length === 0) return null

      // Calculate vertical slot for each event to prevent overlap
      const barHeight = 24 // Height of each bar row
      const totalHeight = spanningEvents.length * barHeight

      return (
        <div 
          className="unified-calendar__month-week-bars"
          style={{ minHeight: `${Math.max(24, totalHeight)}px` }}
        >
          {spanningEvents.map((item, slotIndex) => {
            // Pass currentDate.getMonth() to clip bars to current month only
            const pos = getSpanningBarPosition(item, weekDays, currentDate.getMonth())
            if (!pos) return null

            const colors = getDepartmentColors(item.department)
            // Calculate position within this week (0-6)
            const widthPercent = (pos.span / 7) * 100
            const leftPercent = (pos.startIndex / 7) * 100
            const topOffset = slotIndex * barHeight

            return (
              <button
                type="button"
                key={`spanning-${item.type}-${item.id}`}
                onClick={() => setSelectedEvent(item)}
                className="unified-calendar__month-week-bar"
                style={{
                  '--dept-color': colors.primary,
                  '--dept-bg': colors.bg,
                  '--dept-bg-hover': colors.bgHover,
                  '--dept-text': colors.text,
                  '--dept-glow': colors.glow,
                  '--bar-width': `${widthPercent}%`,
                  '--bar-left': `${leftPercent}%`,
                  top: `${topOffset + 4}px`,
                } as React.CSSProperties}
                title={`${item.title}\n${item.date.toLocaleDateString()} - ${item.dateEnd?.toLocaleDateString()}`}
              >
                <span className="unified-calendar__month-bar-label">
                  {pos.startsBeforeView && <span className="unified-calendar__spanning-arrow">◀</span>}
                  <span className="unified-calendar__spanning-title">{item.title}</span>
                </span>
                <span className="unified-calendar__month-bar-line" />
                {pos.endsAfterView && <span className="unified-calendar__spanning-arrow">▶</span>}
              </button>
            )
          })}
        </div>
      )
    }

    return (
      <div className="unified-calendar__month-container">
        <div className="unified-calendar__month">
          {/* Day-of-week headers row */}
          <div className="unified-calendar__month-header">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="unified-calendar__month-header-day">{day}</div>
            ))}
          </div>
          
          {/* Render each week as a row */}
          {weeks.map((weekDays, weekIndex) => (
            <div key={weekIndex} className="unified-calendar__month-week">
              {/* Date numbers row */}
              <div className="unified-calendar__month-week-dates">
                {weekDays.map((date, dayIndex) => {
                  const isToday = date.toDateString() === new Date().toDateString()
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                  return (
                    <div 
                      key={dayIndex}
                      className={`unified-calendar__month-week-date ${isToday ? 'unified-calendar__month-week-date--today' : ''} ${!isCurrentMonth ? 'unified-calendar__month-week-date--other' : ''}`}
                    >
                      {date.getDate()}
                    </div>
                  )
                })}
              </div>
              
              {/* Spanning bars for this week */}
              {renderWeekSpanningBars(weekDays)}
              
              {/* Day content cells */}
              <div className="unified-calendar__month-week-content">
                {weekDays.map((date, dayIndex) => {
                  const dayItems = getItemsForDay(date)
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                  
                  return (
                    <div 
                      key={dayIndex}
                      className={`unified-calendar__month-week-cell ${!isCurrentMonth ? 'unified-calendar__month-week-cell--other' : ''}`}
                    >
                      {dayItems.slice(0, 2).map(item => (
                        <CalendarItemCard 
                          key={`${item.type}-${item.id}`} 
                          item={item} 
                          compact 
                        />
                      ))}
                      {dayItems.length > 2 && (
                        <div className="unified-calendar__more">
                          +{dayItems.length - 2} more
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="unified-calendar">
      <div className="unified-calendar__header">
        <h1>📅 Organization Calendar</h1>
        <p className="unified-calendar__subtitle">
          View all scheduled tasks, matches, and social posts across departments
        </p>
      </div>

      <DepartmentFilterBar
        enabled={enabledDepartments}
        onChange={setEnabledDepartments}
      />

      <div className="unified-calendar__controls">
        <div className="unified-calendar__view-toggle">
          <button 
            type="button"
            className={`btn btn--small ${viewMode === 'week' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button 
            type="button"
            className={`btn btn--small ${viewMode === 'month' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
        </div>

        <div className="unified-calendar__period">
          {viewMode === 'week' ? (
            <>
              {getStartDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' - '}
              {getEndDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </>
          ) : (
            currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          )}
        </div>

        <div className="unified-calendar__navigation">
          <button type="button" className="btn btn--small btn--secondary" onClick={navigatePrevious}>
            ← Previous
          </button>
          <button type="button" className="btn btn--small btn--secondary" onClick={navigateToday}>
            Today
          </button>
          <button type="button" className="btn btn--small btn--secondary" onClick={navigateNext}>
            Next →
          </button>
        </div>
      </div>

      {loading && (
        <div className="unified-calendar__loading">Loading calendar...</div>
      )}

      {error && (
        <div className="unified-calendar__error">Error: {error}</div>
      )}

      {!loading && !error && (
        <>
          {viewMode === 'week' ? renderWeekView() : renderMonthView()}
          
          <div className="unified-calendar__legend">
            <h4>Departments</h4>
            <div className="unified-calendar__legend-items">
              {DEPARTMENTS.filter(d => enabledDepartments.includes(d.value)).map(dept => (
                <div key={dept.value} className="unified-calendar__legend-item">
                  <span 
                    className="unified-calendar__legend-color" 
                    style={{ backgroundColor: dept.color }}
                  />
                  <span>{dept.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      {/* Event detail modal */}
      {renderEventModal()}
    </div>
  )
}
