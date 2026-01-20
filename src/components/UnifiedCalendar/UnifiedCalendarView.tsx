'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { Department, CalendarItem } from './types'
import { DEPARTMENTS, getDepartmentColor } from './types'
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

  const getItemsForDay = (date: Date) => {
    return items.filter(item => 
      item.date.toDateString() === date.toDateString()
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
      <div className="unified-calendar__week">
        {days.map((date, index) => {
          const dayItems = getItemsForDay(date)
          const isToday = date.toDateString() === new Date().toDateString()
          
          return (
            <div 
              key={index} 
              className={`unified-calendar__day ${isToday ? 'unified-calendar__day--today' : ''}`}
            >
              <div className="unified-calendar__day-header">
                <div className="unified-calendar__day-date">
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="unified-calendar__day-count">
                  {dayItems.length} item{dayItems.length !== 1 ? 's' : ''}
                </div>
              </div>
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
    )
  }

  const renderMonthView = () => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startDayOfWeek = firstDayOfMonth.getDay()
    
    const calendarStartDate = new Date(firstDayOfMonth)
    calendarStartDate.setDate(firstDayOfMonth.getDate() - startDayOfWeek)
    
    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(calendarStartDate)
      date.setDate(calendarStartDate.getDate() + i)
      days.push(date)
    }

    return (
      <div className="unified-calendar__month">
        <div className="unified-calendar__month-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="unified-calendar__month-header-day">{day}</div>
          ))}
        </div>
        <div className="unified-calendar__month-grid">
          {days.map((date, index) => {
            const dayItems = getItemsForDay(date)
            const isToday = date.toDateString() === new Date().toDateString()
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            
            return (
              <div 
                key={index} 
                className={`unified-calendar__month-day ${isToday ? 'unified-calendar__month-day--today' : ''} ${!isCurrentMonth ? 'unified-calendar__month-day--other' : ''}`}
              >
                <div className="unified-calendar__month-day-header">
                  <span className="unified-calendar__month-day-number">{date.getDate()}</span>
                  {dayItems.length > 0 && (
                    <span className="unified-calendar__month-day-count">{dayItems.length}</span>
                  )}
                </div>
                <div className="unified-calendar__month-day-items">
                  {dayItems.slice(0, 3).map(item => (
                    <CalendarItemCard 
                      key={`${item.type}-${item.id}`} 
                      item={item} 
                      compact 
                    />
                  ))}
                  {dayItems.length > 3 && (
                    <div className="unified-calendar__more">
                      +{dayItems.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
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
    </div>
  )
}
