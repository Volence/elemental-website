'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { Calendar, FileEdit, Globe, Link as LinkIcon, ChevronLeft, ChevronRight, RefreshCw, Plus, ExternalLink } from 'lucide-react'
import { AdminModal, AdminPage, AdminPageHeader, Badge, ErrorState, LoadingState, useUrlParamState } from '@/admin-kit'
import type { Person } from '@/payload-types'
import type { Department, CalendarItem } from './types'
import { DEPARTMENTS, getDepartmentColor, getDepartmentColors } from './types'
import { useUnifiedCalendarData } from './useUnifiedCalendarData'
import { DepartmentFilterBar } from './DepartmentFilterBar'
import { CalendarItemCard } from './CalendarItemCard'
import {
  formatDateParam,
  formatPeriodLabel,
  getViewRange,
  isSameDay,
  parseDateParam,
  parseViewMode,
  shiftPeriod,
  startOfDay,
  type CalendarViewMode,
} from './range'
import './UnifiedCalendar.scss'

const STORAGE_KEY = 'unifiedCalendar_enabledDepartments'
const ALL_DEPARTMENTS: Department[] = DEPARTMENTS.map((d) => d.value)

function getUserDepartments(user: Person | null | undefined): Department[] {
  if (!user?.departments) return []
  const deps: Department[] = []
  if (user.departments.isGraphicsStaff) deps.push('graphics')
  if (user.departments.isVideoStaff) deps.push('video')
  if (user.departments.isEventsStaff) deps.push('events')
  if (user.departments.isScoutingStaff) deps.push('scouting')
  if (user.departments.isProductionStaff) deps.push('production')
  if (user.departments.isSocialMediaStaff) deps.push('social-media')
  // Org-wide events are relevant to everyone.
  deps.push('competitive')
  return deps
}

function readSavedDepartments(): Department[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((d): d is Department => ALL_DEPARTMENTS.includes(d))
  } catch {
    return null
  }
}

const LANE_LABELS: Record<string, string> = {
  tasks: 'department tasks',
  matches: 'matches',
  events: 'org events',
}

export default function UnifiedCalendarView() {
  const { user } = useAuth<Person>()

  // View and date live in the URL: reload, back button and shared links all keep them.
  const [viewParam, setViewParam] = useUrlParamState('view', 'week')
  const [dateParam, setDateParam] = useUrlParamState('date', '')
  const viewMode: CalendarViewMode = parseViewMode(viewParam)
  const currentDate = useMemo(() => parseDateParam(dateParam), [dateParam])

  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

  // Department filter: saved selection wins (including an empty one); otherwise the
  // role default. Read synchronously so the first paint is already correct.
  const [enabledDepartments, setEnabledDepartments] = useState<Department[]>(() => readSavedDepartments() ?? ALL_DEPARTMENTS)
  const [appliedDefault, setAppliedDefault] = useState(() => readSavedDepartments() !== null)
  useEffect(() => {
    if (appliedDefault || !user) return
    const defaults =
      user.role === 'admin' || user.role === 'staff-manager' ? ALL_DEPARTMENTS : (() => {
        const mine = getUserDepartments(user)
        return mine.length > 1 ? mine : ALL_DEPARTMENTS
      })()
    setEnabledDepartments(defaults)
    setAppliedDefault(true)
  }, [user, appliedDefault])

  const updateDepartments = useCallback((next: Department[]) => {
    setEnabledDepartments(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable: keep in memory only
    }
  }, [])

  const range = useMemo(() => getViewRange(currentDate, viewMode), [currentDate, viewMode])
  const { items: allItems, loading, error, unavailable, refetch } = useUnifiedCalendarData({
    startDate: range.start,
    endDate: range.end,
  })

  const items = useMemo(() => allItems.filter((item) => enabledDepartments.includes(item.department)), [allItems, enabledDepartments])

  const goTo = (date: Date) => setDateParam(isSameDay(date, new Date()) ? '' : formatDateParam(date))
  const navigatePrevious = () => goTo(shiftPeriod(currentDate, viewMode, -1))
  const navigateNext = () => goTo(shiftPeriod(currentDate, viewMode, 1))
  const navigateToday = () => goTo(new Date())
  const setView = (mode: CalendarViewMode) => setViewParam(mode === 'week' ? 'week' : 'month')

  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return undefined
    }
  }, [])

  const isSpanningEvent = (item: CalendarItem): boolean => {
    if (!item.dateEnd) return false
    return startOfDay(item.dateEnd).getTime() > startOfDay(item.date).getTime()
  }

  const getSpanningEvents = (viewDays: Date[]) => {
    if (viewDays.length === 0) return []
    const viewStart = startOfDay(viewDays[0])
    const viewEnd = new Date(viewDays[viewDays.length - 1])
    viewEnd.setHours(23, 59, 59, 999)
    return items.filter((item) => isSpanningEvent(item) && item.date <= viewEnd && item.dateEnd! >= viewStart)
  }

  const getSpanningBarPosition = (item: CalendarItem, viewDays: Date[], currentMonth?: number) => {
    if (viewDays.length === 0) return null
    const viewStart = startOfDay(viewDays[0])
    const viewEnd = new Date(viewDays[viewDays.length - 1])
    viewEnd.setHours(23, 59, 59, 999)

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
      if (firstMonthDayIdx === -1) return null
    }

    const eventStart = startOfDay(item.date)
    const eventEnd = new Date(item.dateEnd!)
    eventEnd.setHours(23, 59, 59, 999)

    const startIndex = viewDays.findIndex((d) => startOfDay(d).getTime() >= eventStart.getTime())
    let endIndex = viewDays.length - 1
    for (let i = viewDays.length - 1; i >= 0; i--) {
      if (startOfDay(viewDays[i]).getTime() <= eventEnd.getTime()) {
        endIndex = i
        break
      }
    }

    let finalStartIndex = Math.max(0, startIndex === -1 ? 0 : startIndex)
    let finalEndIndex = endIndex
    if (currentMonth !== undefined) {
      if (finalStartIndex < firstMonthDayIdx) finalStartIndex = firstMonthDayIdx
      if (finalEndIndex > lastMonthDayIdx) finalEndIndex = lastMonthDayIdx
      if (viewDays[finalStartIndex].getMonth() !== currentMonth) return null
      if (viewDays[finalEndIndex].getMonth() !== currentMonth) return null
    }

    return {
      startIndex: finalStartIndex,
      endIndex: finalEndIndex,
      span: finalEndIndex - finalStartIndex + 1,
      startsBeforeView: eventStart < viewStart,
      endsAfterView: eventEnd > viewEnd,
    }
  }

  const getItemsForDay = (date: Date) => items.filter((item) => !isSpanningEvent(item) && isSameDay(item.date, date))

  const renderSpanningBar = (item: CalendarItem, pos: NonNullable<ReturnType<typeof getSpanningBarPosition>>, columnCount: number, className: string, extraStyle?: React.CSSProperties) => {
    const colors = getDepartmentColors(item.department)
    return (
      <button
        type="button"
        key={`spanning-${item.type}-${item.id}`}
        onClick={() => setSelectedItem(item)}
        className={className}
        style={
          {
            '--dept-color': colors.primary,
            '--dept-bg': colors.bg,
            '--dept-bg-hover': colors.bgHover,
            '--dept-text': colors.text,
            '--dept-glow': colors.glow,
            '--bar-width': `${(pos.span / columnCount) * 100}%`,
            '--bar-left': `${(pos.startIndex / columnCount) * 100}%`,
            ...extraStyle,
          } as React.CSSProperties
        }
        title={`${item.title}\n${item.date.toLocaleDateString()} - ${item.dateEnd?.toLocaleDateString()}`}
      >
        <span className={className.includes('month') ? 'unified-calendar__month-bar-label' : 'unified-calendar__spanning-label'}>
          {pos.startsBeforeView && (
            <span className="unified-calendar__spanning-arrow">
              <ChevronLeft size={10} />
            </span>
          )}
          <span className="unified-calendar__spanning-title">{item.title}</span>
        </span>
        <span className={className.includes('month') ? 'unified-calendar__month-bar-line' : 'unified-calendar__spanning-line'} />
        {pos.endsAfterView && (
          <span className="unified-calendar__spanning-arrow">
            <ChevronRight size={10} />
          </span>
        )}
      </button>
    )
  }

  const renderSpanningBars = (viewDays: Date[], columnCount: number) => {
    const spanning = getSpanningEvents(viewDays)
    if (spanning.length === 0) return null
    return (
      <div className="unified-calendar__spanning-bars">
        {spanning.map((item) => {
          const pos = getSpanningBarPosition(item, viewDays)
          return pos ? renderSpanningBar(item, pos, columnCount, 'unified-calendar__spanning-bar') : null
        })}
      </div>
    )
  }

  const renderWeekView = () => {
    const days = range.days
    const today = new Date()
    return (
      <div className="unified-calendar__week-container">
        <div className="unified-calendar__week-headers">
          {days.map((date, index) => {
            const isToday = isSameDay(date, today)
            const count = getItemsForDay(date).length
            return (
              <div key={index} className={`unified-calendar__week-header ${isToday ? 'unified-calendar__week-header--today' : ''}`}>
                <div className="unified-calendar__day-date">{date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div className="unified-calendar__day-count">
                  {count} item{count !== 1 ? 's' : ''}
                </div>
              </div>
            )
          })}
        </div>
        {renderSpanningBars(days, 7)}
        <div className="unified-calendar__week">
          {days.map((date, index) => {
            const dayItems = getItemsForDay(date)
            const isToday = isSameDay(date, today)
            return (
              <div key={index} className={`unified-calendar__day ${isToday ? 'unified-calendar__day--today' : ''}`}>
                <div className="unified-calendar__day-items">
                  {dayItems.length === 0 ? (
                    <div className="unified-calendar__empty">Nothing scheduled</div>
                  ) : (
                    dayItems.map((item) => <CalendarItemCard key={`${item.type}-${item.id}`} item={item} onSelect={setSelectedItem} />)
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
    const weeks: Date[][] = []
    for (let w = 0; w < 6; w++) weeks.push(range.days.slice(w * 7, w * 7 + 7))
    const today = new Date()
    const month = currentDate.getMonth()

    const renderWeekSpanningBars = (weekDays: Date[]) => {
      const spanning = getSpanningEvents(weekDays)
      if (spanning.length === 0) return null
      const barHeight = 24
      return (
        <div className="unified-calendar__month-week-bars" style={{ minHeight: `${Math.max(24, spanning.length * barHeight)}px` }}>
          {spanning.map((item, slotIndex) => {
            const pos = getSpanningBarPosition(item, weekDays, month)
            return pos ? renderSpanningBar(item, pos, 7, 'unified-calendar__month-week-bar', { top: `${slotIndex * barHeight + 4}px` }) : null
          })}
        </div>
      )
    }

    return (
      <div className="unified-calendar__month-container">
        <div className="unified-calendar__month">
          <div className="unified-calendar__month-header">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="unified-calendar__month-header-day">
                {day}
              </div>
            ))}
          </div>
          {weeks.map((weekDays, weekIndex) => (
            <div key={weekIndex} className="unified-calendar__month-week">
              <div className="unified-calendar__month-week-dates">
                {weekDays.map((date, dayIndex) => {
                  const isToday = isSameDay(date, today)
                  const isCurrentMonth = date.getMonth() === month
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
              {renderWeekSpanningBars(weekDays)}
              <div className="unified-calendar__month-week-content">
                {weekDays.map((date, dayIndex) => {
                  const dayItems = getItemsForDay(date)
                  const isCurrentMonth = date.getMonth() === month
                  const key = formatDateParam(date)
                  const expanded = !!expandedDays[key]
                  const shown = expanded ? dayItems : dayItems.slice(0, 2)
                  return (
                    <div key={dayIndex} className={`unified-calendar__month-week-cell ${!isCurrentMonth ? 'unified-calendar__month-week-cell--other' : ''}`}>
                      {shown.map((item) => (
                        <CalendarItemCard key={`${item.type}-${item.id}`} item={item} compact onSelect={setSelectedItem} />
                      ))}
                      {dayItems.length > 2 && (
                        <button
                          type="button"
                          className="unified-calendar__more"
                          onClick={() => setExpandedDays((prev) => ({ ...prev, [key]: !expanded }))}
                          aria-expanded={expanded}
                        >
                          {expanded ? 'Show less' : `+${dayItems.length - 2} more`}
                        </button>
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

  const renderDetailModal = () => {
    if (!selectedItem) return null
    const color = getDepartmentColor(selectedItem.department)
    const long: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    const when = selectedItem.dateEnd
      ? `${selectedItem.date.toLocaleDateString('en-US', long)} - ${selectedItem.dateEnd.toLocaleDateString('en-US', long)}`
      : `${selectedItem.date.toLocaleDateString('en-US', long)}, ${selectedItem.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`
    const deptLabel = DEPARTMENTS.find((d) => d.value === selectedItem.department)?.label ?? selectedItem.department
    const openLabel = selectedItem.type === 'task' ? 'Open task' : selectedItem.type === 'match' ? 'Open match' : 'Open event'

    return (
      <AdminModal
        open
        size="md"
        title={selectedItem.title}
        onClose={() => setSelectedItem(null)}
        icon={<span className="unified-calendar__modal-swatch" style={{ background: color }} aria-hidden="true" />}
        footer={
          <>
            <button type="button" className="kit-btn" onClick={() => setSelectedItem(null)}>
              Close
            </button>
            <Link href={selectedItem.href} className="kit-btn kit-btn--primary">
              <ExternalLink size={14} /> {openLabel}
            </Link>
          </>
        }
      >
        <div className="unified-calendar__modal-row">
          <span className="unified-calendar__modal-label">
            <Calendar size={14} /> When
          </span>
          <span>{when}</span>
        </div>
        <div className="unified-calendar__modal-row">
          <span className="unified-calendar__modal-label">Department</span>
          <span>
            <Badge>{deptLabel}</Badge>
            {selectedItem.status && (
              <>
                {' '}
                <Badge tone={/complete|posted/i.test(selectedItem.status) ? 'success' : /progress|scheduled/i.test(selectedItem.status) ? 'info' : 'neutral'}>
                  {selectedItem.status}
                </Badge>
              </>
            )}
            {selectedItem.priority && (
              <>
                {' '}
                <Badge tone={selectedItem.priority === 'urgent' ? 'danger' : selectedItem.priority === 'high' ? 'warning' : 'neutral'}>
                  {selectedItem.priority}
                </Badge>
              </>
            )}
          </span>
        </div>
        {typeof selectedItem.meta?.region === 'string' && (
          <div className="unified-calendar__modal-row">
            <span className="unified-calendar__modal-label">
              <Globe size={14} /> Region
            </span>
            <span>{selectedItem.meta.region}</span>
          </div>
        )}
        {typeof selectedItem.meta?.description === 'string' && selectedItem.meta.description && (
          <div className="unified-calendar__modal-description">
            <span className="unified-calendar__modal-label">
              <FileEdit size={14} /> Details
            </span>
            <p>{selectedItem.meta.description}</p>
          </div>
        )}
        {Array.isArray(selectedItem.meta?.links) && (selectedItem.meta.links as unknown[]).length > 0 && (
          <div className="unified-calendar__modal-links">
            <span className="unified-calendar__modal-label">
              <LinkIcon size={12} /> Links
            </span>
            <div className="unified-calendar__modal-link-buttons">
              {(selectedItem.meta.links as Array<{ label?: string; url?: string }>).map(
                (link, idx) =>
                  link.url && (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="unified-calendar__modal-link">
                      {link.label || 'Link'}
                    </a>
                  ),
              )}
            </div>
          </div>
        )}
      </AdminModal>
    )
  }

  return (
    <AdminPage width="full" className="unified-calendar">
      <AdminPageHeader
        title="Organization Calendar"
        subtitle="Tasks, matches and org events across departments."
        icon={<Calendar size={22} />}
        breadcrumbs={[{ label: 'Organization Calendar' }]}
        actions={
          <>
            <button type="button" className="kit-btn" onClick={refetch} disabled={loading} aria-label="Refresh calendar">
              <RefreshCw size={14} className={loading ? 'kit-spin' : undefined} /> Refresh
            </button>
            {(user?.role === 'admin' || user?.role === 'staff-manager' || user?.role === 'team-manager') && (
              <Link href="/admin/edit-event" className="kit-btn kit-btn--primary">
                <Plus size={14} /> New event
              </Link>
            )}
          </>
        }
      />

      <DepartmentFilterBar enabled={enabledDepartments} onChange={updateDepartments} />

      <div className="unified-calendar__controls">
        <div className="unified-calendar__view-toggle" role="group" aria-label="View">
          <button type="button" className={`btn btn--small ${viewMode === 'week' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setView('week')} aria-pressed={viewMode === 'week'}>
            Week
          </button>
          <button type="button" className={`btn btn--small ${viewMode === 'month' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setView('month')} aria-pressed={viewMode === 'month'}>
            Month
          </button>
        </div>

        <div className="unified-calendar__period">
          {formatPeriodLabel(range, viewMode, currentDate)}
          {timeZone && <span className="unified-calendar__tz">{timeZone}</span>}
        </div>

        <div className="unified-calendar__navigation">
          <button type="button" className="btn btn--small btn--secondary" onClick={navigatePrevious} aria-label={viewMode === 'week' ? 'Previous week' : 'Previous month'}>
            <ChevronLeft size={14} /> Previous
          </button>
          <button type="button" className="btn btn--small btn--secondary" onClick={navigateToday}>
            Today
          </button>
          <button type="button" className="btn btn--small btn--secondary" onClick={navigateNext} aria-label={viewMode === 'week' ? 'Next week' : 'Next month'}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {unavailable.length > 0 && !error && (
        <div className="unified-calendar__notice" role="status">
          Some lanes could not be loaded for your account: {unavailable.map((l) => LANE_LABELS[l] ?? l).join(', ')}.
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading && allItems.length === 0 ? (
        <LoadingState rows={6} />
      ) : (
        <div className={loading ? 'unified-calendar__body unified-calendar__body--refreshing' : 'unified-calendar__body'}>
          {viewMode === 'week' ? renderWeekView() : renderMonthView()}

          <div className="unified-calendar__legend">
            <h4>Departments</h4>
            <div className="unified-calendar__legend-items">
              {DEPARTMENTS.filter((d) => enabledDepartments.includes(d.value)).map((dept) => (
                <div key={dept.value} className="unified-calendar__legend-item">
                  <span className="unified-calendar__legend-color" style={{ backgroundColor: dept.color }} />
                  <span>{dept.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {renderDetailModal()}
    </AdminPage>
  )
}
