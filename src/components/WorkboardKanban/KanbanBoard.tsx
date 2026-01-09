'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useConfig } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'
import { KanbanColumn } from './KanbanColumn'
import { TaskModal } from './TaskModal'
import type { Task } from '@/payload-types'

// Request matrix: which departments can request from which
const REQUEST_MATRIX: Record<string, string[]> = {
  'social-media': ['graphics', 'video'],
  'events': ['social-media', 'graphics', 'video'],
  'video': ['graphics', 'social-media'],
  'graphics': ['social-media'],
  'scouting': ['social-media', 'graphics'],
  'production': ['graphics', 'video'],
}

// Department display names
const DEPT_NAMES: Record<string, string> = {
  'graphics': 'Graphics',
  'video': 'Video',
  'events': 'Events',
  'scouting': 'Scouting',
  'production': 'Production',
  'social-media': 'Social Media',
}

interface KanbanBoardProps {
  department: string
  title: string
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
  const [filter, setFilter] = useState({
    priority: 'all',
    hideComplete: false,
    showArchived: false,
  })
  
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
        'where[archived][equals]': 'false',
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
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchTasks()
      fetchOutgoingRequests()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchTasks, fetchOutgoingRequests])
  
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setRequestTarget(null)
    setIsModalOpen(true)
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
  
  const getFilteredTasks = (status: string) => {
    return tasks.filter((task) => {
      if (task.status !== status) return false
      if (filter.hideComplete && status === 'complete') return false
      if (filter.priority !== 'all' && task.priority !== filter.priority) return false
      // Hide archived tasks unless showArchived is enabled
      if (!filter.showArchived && task.archived) return false
      return true
    })
  }
  
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
      if (task.archived) {
        counts.archived++
      } else if (task.status && counts[task.status as keyof typeof counts] !== undefined) {
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
            <span className="workboard__stat">📋 {counts.backlog} backlog</span>
            <span className="workboard__stat">🔄 {counts['in-progress']} in progress</span>
            <span className="workboard__stat">👀 {counts.review} in review</span>
            <span className="workboard__stat">✅ {counts.complete} complete</span>
          </div>
        </div>
        
        <div className="workboard__actions">
          <select
            className="workboard__filter"
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">🔴 Urgent Only</option>
            <option value="high">🟠 High+</option>
            <option value="medium">🟡 Medium+</option>
          </select>
          
          <label className="workboard__toggle">
            <input
              type="checkbox"
              checked={filter.hideComplete}
              onChange={(e) => setFilter({ ...filter, hideComplete: e.target.checked })}
            />
            Hide Complete
          </label>
          
          <label className="workboard__toggle">
            <input
              type="checkbox"
              checked={filter.showArchived}
              onChange={(e) => setFilter({ ...filter, showArchived: e.target.checked })}
            />
            Show Archived ({counts.archived})
          </label>
          
          <button onClick={fetchTasks} className="workboard__btn workboard__btn--refresh">
            🔄 Refresh
          </button>
          
          {canRequestFrom.length > 0 && (
            <div className="workboard__request-dropdown">
              <button type="button" className="workboard__btn workboard__btn--request">
                📨 Request From...
              </button>
              <div className="workboard__request-menu">
                {canRequestFrom.map((targetDept) => (
                  <button
                    type="button"
                    key={targetDept}
                    className="workboard__request-option"
                    onClick={() => handleNewRequest(targetDept)}
                  >
                    {DEPT_NAMES[targetDept] || targetDept}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <button onClick={handleNewTask} className="workboard__btn workboard__btn--primary">
            + New Task
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
            {showOutgoing ? '▼' : '▶'} 📤 Outgoing Requests ({outgoingRequests.length})
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
                  {req.status === 'backlog' && '📋 Backlog'}
                  {req.status === 'in-progress' && '🔄 In Progress'}
                  {req.status === 'review' && '👀 Review'}
                  {req.status === 'complete' && '✅ Complete'}
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
