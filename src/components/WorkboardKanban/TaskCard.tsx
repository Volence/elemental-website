'use client'

import React from 'react'
import type { Task } from '@/payload-types'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
}

const priorityColors: Record<string, string> = {
  low: 'var(--theme-elevation-100)',
  medium: 'var(--theme-warning-100)',
  high: 'var(--theme-error-100)',
  urgent: 'var(--theme-error-500)',
}

const priorityLabels: Record<string, string> = {
  low: '🔵 Low',
  medium: '🟡 Medium',
  high: '🟠 High',
  urgent: '🔴 Urgent',
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const assignees = task.assignedTo || []
  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'complete'
  
  const getAssigneeName = (user: any): string => {
    if (typeof user === 'object' && user !== null) {
      return user.name || user.email || 'Unknown'
    }
    return 'Unknown'
  }

  return (
    <div
      className="workboard-task-card"
      onClick={() => onClick(task)}
      style={{
        borderLeft: `3px solid ${priorityColors[task.priority || 'medium']}`,
      }}
    >
      <div className="workboard-task-card__title">{task.title}</div>
      
      <div className="workboard-task-card__meta">
        {task.taskType && (
          <span className="workboard-task-card__type">
            {task.taskType.replace(/^(graphics|video|events|scouting)-/, '')}
          </span>
        )}
        
        <span className="workboard-task-card__priority">
          {priorityLabels[task.priority || 'medium']}
        </span>
      </div>
      
      {dueDate && (
        <div className={`workboard-task-card__due ${isOverdue ? 'workboard-task-card__due--overdue' : ''}`}>
          📅 {dueDate.toLocaleDateString()} {isOverdue && '(Overdue!)'}
        </div>
      )}
      
      {assignees.length > 0 && (
        <div className="workboard-task-card__assignees">
          {assignees.slice(0, 3).map((user: any, idx: number) => (
            <span key={idx} className="workboard-task-card__assignee">
              {getAssigneeName(user)}
            </span>
          ))}
          {assignees.length > 3 && (
            <span className="workboard-task-card__more">+{assignees.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default TaskCard
