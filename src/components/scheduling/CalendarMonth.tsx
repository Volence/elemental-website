'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useSchedule } from './ScheduleContext'
import { WeekDetail } from './WeekDetail'
import './CalendarMonth.css'

export function CalendarMonth() {
  const { data } = useSchedule()
  const { recentSchedules } = data

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)

  const scheduleDateMap = useMemo(() => {
    const map: Record<string, { hasCalendar: boolean; hasScrim: boolean }> = {}
    for (const schedule of recentSchedules) {
      const s = schedule as any
      if (!s.dateRange?.start || !s.dateRange?.end) continue
      const start = new Date(s.dateRange.start)
      const end = new Date(s.dateRange.end)
      const current = new Date(start)
      while (current <= end) {
        const key = current.toISOString().split('T')[0]
        if (!map[key]) map[key] = { hasCalendar: false, hasScrim: false }
        map[key].hasCalendar = true
        current.setDate(current.getDate() + 1)
      }
      if (s.schedule?.days) {
        for (const day of s.schedule.days) {
          if (!day.enabled) continue
          for (const block of day.blocks || []) {
            if (block.scrim?.opponent) {
              const dateKey = typeof day.date === 'string' ? day.date : ''
              if (map[dateKey]) map[dateKey].hasScrim = true
            }
          }
        }
      }
    }
    return map
  }, [recentSchedules])

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPad = firstDay.getDay()
    const days: (Date | null)[] = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [currentMonth])

  const weeks = useMemo(() => {
    const result: (Date | null)[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7))
    }
    return result
  }, [calendarDays])

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  const goToday = () => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date().toISOString().split('T')[0]

  const getWeekKey = (week: (Date | null)[]) => {
    const firstDay = week.find(d => d !== null)
    return firstDay ? firstDay.toISOString().split('T')[0] : ''
  }

  const toggleWeek = (weekKey: string) => {
    setExpandedWeek(prev => prev === weekKey ? null : weekKey)
  }

  return (
    <div className="cal-month">
      <div className="cal-month__header">
        <div className="cal-month__header-left">
          <Calendar size={20} />
          <h3 className="cal-month__title">Schedule Calendar</h3>
        </div>
        <div className="cal-month__nav">
          <button className="cal-month__nav-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <span className="cal-month__month-label">{monthLabel}</span>
          <button className="cal-month__nav-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
          <button className="cal-month__today-btn" onClick={goToday}>Today</button>
        </div>
      </div>

      <div className="cal-month__grid">
        <div className="cal-month__weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="cal-month__weekday">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => {
          const weekKey = getWeekKey(week)
          const isExpanded = expandedWeek === weekKey
          return (
            <React.Fragment key={wi}>
              <div
                className={`cal-month__week ${isExpanded ? 'cal-month__week--expanded' : ''}`}
                onClick={() => weekKey && toggleWeek(weekKey)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && weekKey) { e.preventDefault(); toggleWeek(weekKey) } }}
              >
                {week.map((day, di) => {
                  if (!day) return <div key={di} className="cal-month__day cal-month__day--empty"></div>
                  const dateKey = day.toISOString().split('T')[0]
                  const info = scheduleDateMap[dateKey]
                  const isToday = dateKey === today
                  return (
                    <div key={di} className={`cal-month__day ${isToday ? 'cal-month__day--today' : ''}`}>
                      <span className="cal-month__day-num">{day.getDate()}</span>
                      <div className="cal-month__day-dots">
                        {info?.hasCalendar && <span className="cal-month__dot cal-month__dot--calendar"></span>}
                        {info?.hasScrim && <span className="cal-month__dot cal-month__dot--scrim"></span>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {isExpanded && weekKey && (
                <div className="cal-month__week-detail">
                  <WeekDetail weekStart={new Date(weekKey)} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
