'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useConfig } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'
import { KanbanColumn } from './KanbanColumn'
import { TaskModal } from './TaskModal'
import type { Task } from '@/payload-types'

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
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState({
    priority: 'all',
    hideComplete: false,
  })
  
  const fetchTasks = useCallback(async () => {
    try {
      const whereClause = {
        department: { equals: department },
      }
      
      const res = await fetch(
        `${serverURL}/api/tasks?where=${encodeURIComponent(JSON.stringify(whereClause))}&limit=200&sort=priority`,
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
  
  useEffect(() => {
    fetchTasks()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTasks, 30000)
    return () => clearInterval(interval)
  }, [fetchTasks])
  
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setIsModalOpen(true)
  }
  
  const handleNewTask = () => {
    setSelectedTask(null)
    setIsModalOpen(true)
  }
  
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
      return true
    })
  }
  
  const getTaskCounts = () => {
    const counts = {
      backlog: 0,
      'in-progress': 0,
      review: 0,
      complete: 0,
      total: tasks.length,
    }
    
    tasks.forEach((task) => {
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
          <h1 className="workboard__title">{title}</h1>
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
          
          <button onClick={fetchTasks} className="workboard__btn workboard__btn--refresh">
            🔄 Refresh
          </button>
          
          <button onClick={handleNewTask} className="workboard__btn workboard__btn--primary">
            + New Task
          </button>
        </div>
      </div>
      
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
        department={department}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchTasks}
      />
    </div>
  )
}

export default KanbanBoard
