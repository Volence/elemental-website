'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useConfig } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'
import { ClipboardList, RefreshCw, Eye, CheckCircle, Send, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react'
import { KanbanColumn } from './KanbanColumn'
import { TaskModal } from './TaskModal'
import type { Task } from '@/payload-types'
import { compareTasksByDueDate } from '@/utilities/taskDueDate'
import { useAuth } from '@payloadcms/ui'
import { useUrlParamState } from '@/admin-kit'
import { DEPT_NAMES, REQUEST_MATRIX, PRIORITY_FILTER_OPTIONS, priorityFilterMatches } from './constants'



interface KanbanBoardProps {
  department: string
  title?: string
}

const COLUMNS = [
  { status: 'backlog', title: 'Backlog' },
  { status: 'in-progress', title: 'In Progress' },
  { status: 'review', title: 'Review' },
  { status: 'complete', title: 'Complete' },
]

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ department, title }) => {
  const { config } = useConfig()
  const serverURL = config?.serverURL || ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requestTarget, setRequestTarget] = useState<string | null>(null)
  const [showOutgoing, setShowOutgoing] = useState(false)
  // Filters live in the URL so they survive reload and can be shared.
  const { user: currentUser } = useAuth()
  const [priorityFilter, setPriorityFilter] = useUrlParamState('priority', 'all')
  const [hideCompleteParam, setHideCompleteParam] = useUrlParamState('hideComplete', '0')
  const [showArchivedParam, setShowArchivedParam] = useUrlParamState('archived', '0')
  const [mineParam, setMineParam] = useUrlParamState('mine', '0')
  const filter = {
    priority: priorityFilter,
    hideComplete: hideCompleteParam === '1',
    showArchived: showArchivedParam === '1',
    mine: mineParam === '1',
  }
  const [requestMenuOpen, setRequestMenuOpen] = useState(false)
  const requestMenuRef = React.useRef<HTMLDivElement | null>(null)

  // Deep link: /board?task=<id> (used by the Organization Calendar) opens that task.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const deepLinkTaskId = searchParams?.get('task') ?? null
  const [deepLinkHandled, setDeepLinkHandled] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      // Use bracket notation for query
      const queryParams = new URLSearchParams({
        'where[department][equals]': department,
        'limit': '200',
        'sort': 'priority',
        'depth': '1',
      })

      const res = await fetch(
        `${serverURL}/api/tasks?${queryParams.toString()}`,
        { credentials: 'include' }
      )

      if (res.ok) {
        const data = await res.json()
        setTasks(data.docs || [])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [department, serverURL])

  // Fetch requests made by this department to others (exclude archived)
  const fetchOutgoingRequests = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        'where[requestedByDepartment][equals]': department,
        'where[isRequest][equals]': 'true',
        'where[archived][not_equals]': 'true',
        'limit': '50',
        'sort': '-createdAt',
        'depth': '1',
      })

      const res = await fetch(
        `${serverURL}/api/tasks?${queryParams.toString()}`,
        { credentials: 'include' }
      )

      if (res.ok) {
        const data = await res.json()
        setOutgoingRequests(data.docs || [])
      }
    } catch (err) {
      console.error('Failed to fetch outgoing requests:', err)
    }
  }, [department, serverURL])

  useEffect(() => {
    fetchTasks()
    fetchOutgoingRequests()

    // Auto-refresh every 30 seconds, but not while the tab is hidden or a task is being edited
    // (a refetch under an open modal used to overwrite optimistic drags mid-edit).
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (isModalOpenRef.current) return
      fetchTasks()
      fetchOutgoingRequests()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchTasks, fetchOutgoingRequests])

  const isModalOpenRef = React.useRef(false)
  useEffect(() => {
    isModalOpenRef.current = isModalOpen
  }, [isModalOpen])

  // Close the request menu on outside click or Escape
  useEffect(() => {
    if (!requestMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (requestMenuRef.current && !requestMenuRef.current.contains(e.target as Node)) setRequestMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRequestMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [requestMenuOpen])

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setRequestTarget(null)
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (deepLinkHandled || !deepLinkTaskId || loading) return
    const match = tasks.find((t) => String(t.id) === deepLinkTaskId)
    setDeepLinkHandled(true)
    if (match) {
      handleTaskClick(match)
    } else {
      toast.error('That task is not on this board (it may be archived or belong to another department).')
    }
  }, [deepLinkHandled, deepLinkTaskId, loading, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearDeepLink = () => {
    if (!deepLinkTaskId) return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('task')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const handleNewTask = () => {
    setSelectedTask(null)
    setRequestTarget(null)
    setIsModalOpen(true)
  }

  const handleNewRequest = (targetDept: string) => {
    setSelectedTask(null)
    setRequestTarget(targetDept)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    clearDeepLink()
    setIsModalOpen(false)
    setRequestTarget(null)
  }

  // Get departments this department can request from
  const canRequestFrom = REQUEST_MATRIX[department] || []

  const handleDrop = async (taskId: number, newStatus: string) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as any } : t))
    )

    try {
      const res = await fetch(`${serverURL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      toast.success('Status updated!')
    } catch (err) {
      toast.error('Failed to update task')
      fetchTasks() // Revert on error
    }
  }

  const isMine = (task: Task) =>
    !!currentUser && (task.assignedTo || []).some((u: any) => (typeof u === 'number' ? u : u?.id) === currentUser.id)

  const passesFilters = (task: Task) => {
    if (!priorityFilterMatches(filter.priority, task.priority)) return false
    if (!filter.showArchived && task.archived) return false
    if (filter.mine && !isMine(task)) return false
    return true
  }

  const getFilteredTasks = (status: string) => {
    return tasks
      .filter((task) => task.status === status && passesFilters(task))
      .sort(compareTasksByDueDate) // soonest due first, undated last
  }

  // Header counts reflect the active filters so they match the cards on screen.
  const getTaskCounts = () => {
    const counts = {
      backlog: 0,
      'in-progress': 0,
      review: 0,
      complete: 0,
      archived: 0,
      total: tasks.length,
    }

    tasks.forEach((task) => {
      if (task.archived) counts.archived++
      if (!passesFilters(task)) return
      if (task.archived) return
      if (task.status && counts[task.status as keyof typeof counts] !== undefined) {
        counts[task.status as keyof typeof counts]++
      }
    })

    return counts
  }

  const counts = getTaskCounts()

  if (loading) {
    return (
      <div className="workboard-loading">
        <div className="workboard-loading__spinner" />
        <span>Loading tasks...</span>
      </div>
    )
  }

  return (
    <div className="workboard">
      <div className="workboard__header">
        <div className="workboard__title-section">
          <div className="workboard__stats">
            <span className="workboard__stat"><ClipboardList size={12} /> {counts.backlog} backlog</span>
            <span className="workboard__stat"><RefreshCw size={12} /> {counts['in-progress']} in progress</span>
            <span className="workboard__stat"><Eye size={12} /> {counts.review} in review</span>
            <span className="workboard__stat"><CheckCircle size={12} /> {counts.complete} complete</span>
          </div>
        </div>

        <div className="workboard__actions">
          <select
            className="workboard__filter"
            value={filter.priority}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Priority filter"
          >
            {PRIORITY_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {currentUser && (
            <label className="workboard__toggle">
              <input
                type="checkbox"
                checked={filter.mine}
                onChange={(e) => setMineParam(e.target.checked ? '1' : '0')}
              />
              My tasks
            </label>
          )}

          <label className="workboard__toggle">
            <input
              type="checkbox"
              checked={filter.hideComplete}
              onChange={(e) => setHideCompleteParam(e.target.checked ? '1' : '0')}
            />
            Hide complete
          </label>

          <label className="workboard__toggle">
            <input
              type="checkbox"
              checked={filter.showArchived}
              onChange={(e) => setShowArchivedParam(e.target.checked ? '1' : '0')}
            />
            Show archived ({counts.archived})
          </label>

          <button onClick={fetchTasks} className="workboard__btn workboard__btn--refresh">
            <RefreshCw size={12} /> Refresh
          </button>

          {canRequestFrom.length > 0 && (
            <div className={`workboard__request-dropdown${requestMenuOpen ? ' workboard__request-dropdown--open' : ''}`} ref={requestMenuRef}>
              <button
                type="button"
                className="workboard__btn workboard__btn--request"
                onClick={() => setRequestMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={requestMenuOpen}
              >
                <Send size={12} /> Request from
              </button>
              {requestMenuOpen && (
                <div className="workboard__request-menu" role="menu">
                  {canRequestFrom.map((targetDept) => (
                    <button
                      type="button"
                      role="menuitem"
                      key={targetDept}
                      className="workboard__request-option"
                      onClick={() => {
                        setRequestMenuOpen(false)
                        handleNewRequest(targetDept)
                      }}
                    >
                      {DEPT_NAMES[targetDept] || targetDept}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={handleNewTask} className="workboard__btn workboard__btn--primary">
            + New task
          </button>
        </div>
      </div>

      {/* Outgoing Requests Toggle */}
      {outgoingRequests.length > 0 && (
        <div className="workboard__outgoing-header">
          <button
            type="button"
            className="workboard__outgoing-toggle"
            onClick={() => setShowOutgoing(!showOutgoing)}
          >
            {showOutgoing ? <ChevronDown size={12} /> : <ChevronRight size={12} />} <ArrowUpRight size={12} /> Outgoing Requests ({outgoingRequests.length})
          </button>
        </div>
      )}

      {/* Outgoing Requests List */}
      {showOutgoing && outgoingRequests.length > 0 && (
        <div className="workboard__outgoing-list">
          {outgoingRequests.map((req) => (
            <div
              key={req.id}
              className="workboard__outgoing-item"
              onClick={() => handleTaskClick(req)}
            >
              <div className="workboard__outgoing-info">
                <span className="workboard__outgoing-title">{req.title}</span>
                <span className="workboard__outgoing-dept">
                  → {DEPT_NAMES[req.department as string] || req.department}
                </span>
              </div>
              <div className="workboard__outgoing-status">
                <span className={`workboard__status-badge workboard__status-badge--${req.status}`}>
                  {req.status === 'backlog' && <><ClipboardList size={10} /> Backlog</>}
                  {req.status === 'in-progress' && <><RefreshCw size={10} /> In Progress</>}
                  {req.status === 'review' && <><Eye size={10} /> Review</>}
                  {req.status === 'complete' && <><CheckCircle size={10} /> Complete</>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="workboard__board">
        {COLUMNS.map((col) => {
          if (filter.hideComplete && col.status === 'complete') return null

          return (
            <KanbanColumn
              key={col.status}
              title={col.title}
              status={col.status}
              tasks={getFilteredTasks(col.status)}
              onTaskClick={handleTaskClick}
              onDrop={handleDrop}
            />
          )
        })}
      </div>

      <TaskModal
        task={selectedTask}
        department={requestTarget || department}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={() => {
          fetchTasks()
          fetchOutgoingRequests()
        }}
        isRequest={!!requestTarget}
        requestedByDepartment={requestTarget ? department : undefined}
      />
    </div>
  )
}

export default KanbanBoard
