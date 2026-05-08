'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Check, HelpCircle, Save, Loader2 } from 'lucide-react'
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
        const rangeStart = new Date(s.dateRange.start)
        for (let i = 0; i < s.schedule.days.length; i++) {
          const day = s.schedule.days[i]
          if (!day.enabled) continue
          const hasScrim = (day.blocks || []).some((b: any) => b.scrim?.opponent)
          if (!hasScrim) continue
          const dayDate = new Date(rangeStart)
          dayDate.setDate(dayDate.getDate() + i)
          const dateKey = day.isoDate || dayDate.toISOString().split('T')[0]
          if (map[dateKey]) map[dateKey].hasScrim = true
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

  const weekHasSchedule = useCallback((weekStartDate: Date) => {
    const weekEnd = new Date(weekStartDate)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const startStr = weekStartDate.toISOString().split('T')[0]
    const endStr = weekEnd.toISOString().split('T')[0]
    return (recentSchedules as any[]).some(s => {
      if (!s.dateRange?.start || !s.dateRange?.end) return false
      return s.dateRange.start.split('T')[0] <= endStr && s.dateRange.end.split('T')[0] >= startStr
    })
  }, [recentSchedules])

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
                  {weekHasSchedule(new Date(weekKey)) ? (
                    <WeekDetail weekStart={new Date(weekKey)} />
                  ) : (
                    <FutureAvailabilityForm weekStart={new Date(weekKey)} onClose={() => setExpandedWeek(null)} />
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

function FutureAvailabilityForm({ weekStart, onClose }: { weekStart: Date; onClose: () => void }) {
  const { data, refreshData } = useSchedule()
  const { team, authState } = data
  const scheduleBlocks = team.scheduleBlocks || []

  const weekDates = useMemo(() => {
    const dates: string[] = []
    const current = new Date(weekStart)
    for (let i = 0; i < 7; i++) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return dates
  }, [weekStart])

  const [selections, setSelections] = useState<Record<string, Record<string, 'available' | 'maybe' | null>>>(() => {
    const init: Record<string, Record<string, 'available' | 'maybe' | null>> = {}
    weekDates.forEach(date => {
      init[date] = {}
      scheduleBlocks.forEach(block => { init[date][block.startTime] = null })
    })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!authState.isAuthenticated) {
    return (
      <div className="cal-month__future-empty">
        <p>No schedule for this week yet. Sign in to pre-mark your availability.</p>
      </div>
    )
  }

  if (scheduleBlocks.length === 0) {
    return (
      <div className="cal-month__future-empty">
        <p>No schedule blocks configured for this team.</p>
      </div>
    )
  }

  const cycleCell = (date: string, slotTime: string) => {
    setSelections(prev => {
      const current = prev[date]?.[slotTime]
      let next: 'available' | 'maybe' | null
      if (!current) next = 'available'
      else if (current === 'available') next = 'maybe'
      else next = null
      return { ...prev, [date]: { ...prev[date], [slotTime]: next } }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const cleanSelections: Record<string, Record<string, 'available' | 'maybe'>> = {}
    Object.entries(selections).forEach(([date, slots]) => {
      Object.entries(slots).forEach(([time, status]) => {
        if (status) {
          if (!cleanSelections[date]) cleanSelections[date] = {}
          cleanSelections[date][time] = status
        }
      })
    })
    try {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          type: 'pre-availability',
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          selections: cleanSelections,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      await refreshData()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return (
    <div className="cal-month__future-form">
      <h4 className="cal-month__future-title">Pre-mark your availability</h4>
      <div className="cal-month__future-grid-wrapper">
        <table className="cal-month__future-grid">
          <thead>
            <tr>
              <th></th>
              {weekDates.map(date => (
                <th key={date} className="cal-month__future-day-header">{getDayLabel(date)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scheduleBlocks.map(block => (
              <tr key={block.startTime}>
                <td className="cal-month__future-slot-label">{block.label}</td>
                {weekDates.map(date => {
                  const status = selections[date]?.[block.startTime]
                  return (
                    <td
                      key={`${date}-${block.startTime}`}
                      className={`cal-month__future-cell ${status === 'available' ? 'cal-month__future-cell--available' : status === 'maybe' ? 'cal-month__future-cell--maybe' : 'cal-month__future-cell--empty'}`}
                      onClick={() => cycleCell(date, block.startTime)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleCell(date, block.startTime) } }}
                    >
                      {status === 'available' ? <Check size={14} strokeWidth={3} /> : status === 'maybe' ? <HelpCircle size={12} /> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="cal-month__future-error">{error}</p>}
      <div className="cal-month__future-actions">
        <button className="cal-month__future-cancel" onClick={onClose}>Cancel</button>
        <button className="cal-month__future-save" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={14} className="cal-month__spinner" /> Saving...</> : <><Save size={14} /> Save</>}
        </button>
      </div>
    </div>
  )
}
