'use client'

import React from 'react'
import { TaskCard } from './TaskCard'
import type { Task } from '@/payload-types'

interface KanbanColumnProps {
  title: string
  status: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onDrop: (taskId: number, newStatus: string) => void
}

const statusIcons: Record<string, string> = {
  backlog: '📋',
  'in-progress': '🔄',
  review: '👀',
  complete: '✅',
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  tasks,
  onTaskClick,
  onDrop,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('workboard-column--drag-over')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('workboard-column--drag-over')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('workboard-column--drag-over')
    
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) {
      onDrop(parseInt(taskId, 10), status)
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('taskId', taskId.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className="workboard-column"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="workboard-column__header">
        <span className="workboard-column__icon">{statusIcons[status]}</span>
        <span className="workboard-column__title">{title}</span>
        <span className="workboard-column__count">{tasks.length}</span>
      </div>
      
      <div className="workboard-column__tasks">
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
          >
            <TaskCard task={task} onClick={onTaskClick} />
          </div>
        ))}
        
        {tasks.length === 0 && (
          <div className="workboard-column__empty">
            No tasks
          </div>
        )}
      </div>
    </div>
  )
}

export default KanbanColumn
