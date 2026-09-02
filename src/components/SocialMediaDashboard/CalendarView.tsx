'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth, useConfig, toast } from '@payloadcms/ui'
import { Plus, Send, CalendarClock, Users } from 'lucide-react'
import type { Task } from '@/payload-types'
import { TaskModal } from '../WorkboardKanban/TaskModal'
import { DigestModal } from './DigestModal'
import { UpcomingStrip, type PromoPrefill } from './UpcomingStrip'
import { getPostTypeColor, SOCIAL_POST_TYPES } from '@/utilities/socialPostTypes'
import {
  addDays,
  dueDateKey,
  localDateKey,
  monthBoundsFor,
  weekBoundsFor,
} from '@/utilities/taskDueDate'

type ViewMode = 'week' | 'month'

const VIEW_MODE_KEY = 'sm-calendar-view-mode'
const ASSIGNEE_KEY = 'sm-calendar-assignee'
const DEPARTMENT = 'social-media'

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  review: 'Review',
  complete: 'Complete',
}

function readStoredViewMode(): ViewMode {
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY)
    return v === 'month' ? 'month' : 'week'
  } catch {
    return 'week'
  }
}

function assigneeName(user: any): string {
  if (typeof user === 'object' && user !== null) return user.name || user.email || 'Unknown'
  return 'Unknown'
}

export function CalendarView() {
  const { config } = useConfig()
  const { user } = useAuth()
  const serverURL = config?.serverURL || ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [unscheduled, setUnscheduled] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  // Start as 'week' for SSR, then adopt the remembered choice on mount
  const [viewMode, setViewModeState] = useState<ViewMode>('week')
  const [hydrated, setHydrated] = useState(false)

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [initialDueDate, setInitialDueDate] = useState<string | undefined>(undefined)
  const [initialValues, setInitialValues] = useState<PromoPrefill | undefined>(undefined)
  // 'all' | 'me' | person id as string
  const [assigneeFilter, setAssigneeFilterState] = useState<string>('all')
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDigestOpen, setIsDigestOpen] = useState(false)

  useEffect(() => {
    setViewModeState(readStoredViewMode())
    try {
      setAssigneeFilterState(window.localStorage.getItem(ASSIGNEE_KEY) || 'all')
    } catch {
      /* best effort */
    }
    setHydrated(true)
  }, [])

  const setAssigneeFilter = (value: string) => {
    setAssigneeFilterState(value)
    try {
      window.localStorage.setItem(ASSIGNEE_KEY, value)
    } catch {
      /* best effort */
    }
  }

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, mode)
    } catch {
      /* private mode etc. - remembering is best effort */
    }
  }

  const bounds = useMemo(
    () => (viewMode === 'week' ? weekBoundsFor(currentDate) : monthBoundsFor(currentDate)),
    [currentDate, viewMode],
  )

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch a day either side: date-only due dates live at UTC midnight and
      // are bucketed client-side by calendar day (see dueDateKey).
      const from = addDays(bounds.start, -1).toISOString()
      const to = addDays(bounds.end, 1).toISOString()
      const params = new URLSearchParams({
        'where[department][equals]': DEPARTMENT,
        'where[archived][not_equals]': 'true',
        'where[dueDate][greater_than_equal]': from,
        'where[dueDate][less_than_equal]': to,
        limit: '300',
        depth: '1',
        sort: 'dueDate',
      })
      const res = await fetch(`${serverURL}/api/tasks?${params}`, { credentials: 'include' })
      const data = await res.json()
      setTasks(data.docs || [])
    } catch (err) {
      console.error('Error fetching calendar tasks:', err)
      toast.error('Failed to load calendar')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [bounds, serverURL])

  const fetchUnscheduled = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        'where[department][equals]': DEPARTMENT,
        'where[archived][not_equals]': 'true',
        'where[status][not_equals]': 'complete',
        'where[dueDate][exists]': 'false',
        limit: '50',
        depth: '1',
        sort: '-createdAt',
      })
      const res = await fetch(`${serverURL}/api/tasks?${params}`, { credentials: 'include' })
      const data = await res.json()
      setUnscheduled(data.docs || [])
    } catch {
      setUnscheduled([])
    }
  }, [serverURL])

  useEffect(() => {
    if (!hydrated) return
    fetchTasks()
    fetchUnscheduled()
  }, [hydrated, fetchTasks, fetchUnscheduled])

  const assigneeIds = (t: Task): number[] =>
    ((t.assignedTo || []) as any[]).map((a) => (typeof a === 'object' && a ? a.id : a)).filter((v) => v != null)

  // Tasks inside the visible range (the fetch is padded by a day either side)
  const rangeTasks = useMemo(() => {
    const startKey = localDateKey(bounds.start)
    const endKey = localDateKey(bounds.end)
    return tasks.filter((t) => {
      const k = dueDateKey(t.dueDate)
      return !!k && k >= startKey && k <= endKey
    })
  }, [tasks, bounds])

  // People who have posts in this range, with counts, for the filter dropdown
  const people = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>()
    for (const t of rangeTasks) {
      for (const a of (t.assignedTo || []) as any[]) {
        if (typeof a !== 'object' || !a) continue
        const entry = map.get(a.id) || { id: a.id, name: a.name || a.email || 'Unknown', count: 0 }
        entry.count++
        map.set(a.id, entry)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [rangeTasks])

  const matchesFilter = (t: Task): boolean => {
    if (assigneeFilter === 'all') return true
    if (assigneeFilter === 'me') return !!user && assigneeIds(t).includes(user.id as number)
    return assigneeIds(t).includes(Number(assigneeFilter))
  }

  const myCount = user ? rangeTasks.filter((t) => assigneeIds(t).includes(user.id as number)).length : 0
  const unassignedCount = rangeTasks.filter((t) => assigneeIds(t).length === 0).length

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (assigneeFilter === 'me' && !(user && assigneeIds(t).includes(user.id as number))) continue
      if (assigneeFilter === 'unassigned' && assigneeIds(t).length > 0) continue
      if (assigneeFilter !== 'all' && assigneeFilter !== 'me' && assigneeFilter !== 'unassigned' && !assigneeIds(t).includes(Number(assigneeFilter))) continue
      const key = dueDateKey(t.dueDate)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, assigneeFilter, user?.id])

  const getTasksForDay = (date: Date) => tasksByDay.get(localDateKey(date)) || []

  // --- navigation ---
  const navigatePrevious = () => {
    setCurrentDate(
      viewMode === 'week'
        ? addDays(currentDate, -7)
        : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    )
  }
  const navigateNext = () => {
    setCurrentDate(
      viewMode === 'week'
        ? addDays(currentDate, 7)
        : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    )
  }
  const navigateToday = () => setCurrentDate(new Date())

  // --- modal ---
  const openTask = (task: Task) => {
    setSelectedTask(task)
    setInitialDueDate(undefined)
    setInitialValues(undefined)
    setIsModalOpen(true)
  }
  const openNewTask = (date?: Date) => {
    setSelectedTask(null)
    setInitialDueDate(date ? localDateKey(date) : undefined)
    setInitialValues(undefined)
    setIsModalOpen(true)
  }
  const openPromoTask = (prefill: PromoPrefill) => {
    setSelectedTask(null)
    setInitialDueDate(prefill.dueDate)
    setInitialValues(prefill)
    setIsModalOpen(true)
  }
  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedTask(null)
    setInitialDueDate(undefined)
    setInitialValues(undefined)
  }

  // --- drag to reschedule ---
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', String(task.id))
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverKey !== key) setDragOverKey(key)
  }
  const handleDrop = async (e: React.DragEvent, key: string) => {
    e.preventDefault()
    setDragOverKey(null)
    const id = Number(e.dataTransfer.getData('taskId'))
    if (!id) return
    const task = tasks.find((t) => t.id === id) || unscheduled.find((t) => t.id === id)
    if (!task || dueDateKey(task.dueDate) === key) return

    // Optimistic move (date-only due dates are stored at UTC midnight)
    const newDueDate = `${key}T00:00:00.000Z`
    setTasks((prev) => (prev.some((t) => t.id === id) ? prev.map((t) => (t.id === id ? { ...t, dueDate: newDueDate } : t)) : [...prev, { ...task, dueDate: newDueDate }]))
    setUnscheduled((prev) => prev.filter((t) => t.id !== id))
    try {
      const res = await fetch(`${serverURL}/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dueDate: key }),
      })
      if (!res.ok) throw new Error('Failed to move task')
      toast.success(`Moved to ${parseKeyLabel(key)}`)
    } catch {
      toast.error('Failed to move task')
      fetchTasks()
      fetchUnscheduled()
    }
  }
  const parseKeyLabel = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const afterSave = () => {
    fetchTasks()
    fetchUnscheduled()
  }

  const todayKey = localDateKey(new Date())

  const renderTaskCard = (task: Task, compact = false) => {
    const color = getPostTypeColor(task.postType)
    const assignees = (task.assignedTo || []) as any[]
    const isComplete = task.status === 'complete'
    return (
      <button
        type="button"
        key={task.id}
        className={`calendar-post-card ${isComplete ? 'calendar-post-card--complete' : ''} ${compact ? 'calendar-post-card--compact' : ''}`}
        style={{ borderLeft: `4px solid ${color}` }}
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onClick={() => openTask(task)}
        title={`${task.title}${task.postType ? ` (${task.postType})` : ''}`}
      >
        <div className="calendar-post-card__title">{task.title}</div>
        {!compact && (
          <>
            <div className="calendar-post-card__type" style={{ color }}>
              {task.postType || 'No post type'}
              {task.platform ? ` • ${task.platform}` : ''}
            </div>
            <div className="calendar-post-card__footer">
              <span className={`calendar-post-card__status calendar-post-card__status--${task.status}`}>
                {STATUS_LABELS[task.status] || task.status}
              </span>
              {assignees.length > 0 && (
                <span className="calendar-post-card__assignees">
                  {assignees.slice(0, 3).map((u, i) => (
                    <span key={i} className="calendar-post-card__avatar" title={assigneeName(u)}>
                      {assigneeName(u).charAt(0).toUpperCase()}
                    </span>
                  ))}
                  {assignees.length > 3 && (
                    <span className="calendar-post-card__avatar calendar-post-card__avatar--more">
                      +{assignees.length - 3}
                    </span>
                  )}
                </span>
              )}
            </div>
          </>
        )}
      </button>
    )
  }

  const renderWeekView = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(bounds.start, i))
    return (
      <div className="calendar-view__week">
        {days.map((date) => {
          const dayTasks = getTasksForDay(date)
          const key = localDateKey(date)
          const isToday = key === todayKey
          return (
            <div
              key={key}
              className={`calendar-day ${isToday ? 'calendar-day--today' : ''} ${dragOverKey === key ? 'calendar-day--drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => handleDrop(e, key)}
            >
              <div className="calendar-day__header">
                <div>
                  <div className="calendar-day__date">
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="calendar-day__count">
                    {dayTasks.length} post{dayTasks.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="calendar-day__add"
                  onClick={() => openNewTask(date)}
                  title="Schedule a post on this day"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="calendar-day__posts">
                {dayTasks.length === 0 ? (
                  <div className="calendar-day__empty">Nothing scheduled</div>
                ) : (
                  dayTasks.map((t) => renderTaskCard(t))
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
    const gridStart = addDays(firstDayOfMonth, -firstDayOfMonth.getDay())
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

    return (
      <div className="calendar-view__month">
        <div className="calendar-month-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="calendar-month-header__day">{day}</div>
          ))}
        </div>
        <div className="calendar-month-grid">
          {days.map((date) => {
            const dayTasks = getTasksForDay(date)
            const key = localDateKey(date)
            const isToday = key === todayKey
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <div
                key={key}
                className={`calendar-month-day ${isToday ? 'calendar-month-day--today' : ''} ${!isCurrentMonth ? 'calendar-month-day--other-month' : ''} ${isWeekend ? 'calendar-month-day--weekend' : ''} ${dragOverKey === key ? 'calendar-month-day--drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => handleDrop(e, key)}
              >
                <div className="calendar-month-day__header">
                  <span className="calendar-month-day__date">{date.getDate()}</span>
                  <button
                    type="button"
                    className="calendar-month-day__add"
                    onClick={() => openNewTask(date)}
                    title="Schedule a post on this day"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="calendar-month-day__posts">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      className={`calendar-month-post ${task.status === 'complete' ? 'calendar-month-post--complete' : ''}`}
                      style={{ borderLeft: `3px solid ${getPostTypeColor(task.postType)}` }}
                      title={`${task.title}${task.postType ? ` (${task.postType})` : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={() => openTask(task)}
                    >
                      <span className="calendar-month-post__title">{task.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="calendar-month-day__more">+{dayTasks.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const periodLabel =
    viewMode === 'week'
      ? `Week of ${bounds.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${bounds.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="calendar-view">
      <div className="calendar-view__header">
        <div>
          <h2>Content Calendar</h2>
          <p className="calendar-view__subtitle">
            Social media workboard tasks by due date. Click a card to edit it, drag it to another day to reschedule, or use + to schedule a new post.
          </p>
        </div>
        <div className="calendar-view__controls">
          <label className="calendar-filter" title="Filter by assignee">
            <Users size={13} />
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="all">Everyone ({rangeTasks.length})</option>
              {user && <option value="me">My posts ({myCount})</option>}
              {unassignedCount > 0 && <option value="unassigned">Unassigned ({unassignedCount})</option>}
              {people.filter((p) => !user || p.id !== user.id).map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name} ({p.count})</option>
              ))}
            </select>
          </label>
          <div className="view-mode-toggle">
            <button
              className={`btn btn--small ${viewMode === 'week' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button
              className={`btn btn--small ${viewMode === 'month' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
          </div>
          <div className="calendar-navigation">
            <button className="btn btn--small btn--secondary" onClick={navigatePrevious}>
              &larr; Previous
            </button>
            <button className="btn btn--small btn--secondary" onClick={navigateToday}>
              Today
            </button>
            <button className="btn btn--small btn--secondary" onClick={navigateNext}>
              Next &rarr;
            </button>
          </div>
          <div className="calendar-actions">
            <button className="btn btn--small btn--secondary" onClick={() => setIsDigestOpen(true)}>
              <Send size={12} /> Post Week to Discord
            </button>
            <button className="btn btn--small btn--primary" onClick={() => openNewTask()}>
              <Plus size={12} /> New Post
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-view__period">{periodLabel}</div>

      {loading && tasks.length === 0 ? (
        <div className="loading-spinner">Loading calendar...</div>
      ) : viewMode === 'week' ? (
        renderWeekView()
      ) : (
        renderMonthView()
      )}

      {unscheduled.length > 0 && (
        <div className="calendar-view__unscheduled">
          <h4>
            <CalendarClock size={14} /> Unscheduled ({unscheduled.length})
          </h4>
          <p>Workboard tasks without a due date. Open one and set a date to put it on the calendar.</p>
          <div className="calendar-view__unscheduled-list">
            {unscheduled.map((t) => renderTaskCard(t, true))}
          </div>
        </div>
      )}

      <UpcomingStrip onCreatePromo={openPromoTask} />

      <div className="calendar-view__legend">
        <h4>Post Types</h4>
        <div className="legend-items">
          {SOCIAL_POST_TYPES.map((type) => (
            <div key={type.value} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: getPostTypeColor(type.value) }} />
              <span>{type.label}</span>
            </div>
          ))}
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: getPostTypeColor(null) }} />
            <span>No post type</span>
          </div>
        </div>
      </div>

      <TaskModal
        task={selectedTask}
        department={DEPARTMENT}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={afterSave}
        initialDueDate={initialDueDate}
        initialValues={initialValues}
      />

      <DigestModal
        isOpen={isDigestOpen}
        onClose={() => setIsDigestOpen(false)}
        start={weekBoundsFor(currentDate).start}
        end={weekBoundsFor(currentDate).end}
      />
    </div>
  )
}
