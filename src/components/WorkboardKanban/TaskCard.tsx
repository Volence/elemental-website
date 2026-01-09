'use client'

import React from 'react'
import type { Task } from '@/payload-types'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
}

const priorityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
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

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const assignees = task.assignedTo || []
  const attachments = task.attachments || []
  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'complete'
  const priority = task.priority || 'medium'
  const isRequest = task.isRequest === true
  const requestedByDept = task.requestedByDepartment
  
  const getAssigneeName = (user: any): string => {
    if (typeof user === 'object' && user !== null) {
      return user.name || user.email || 'Unknown'
    }
    return 'Unknown'
  }

  // Format date nicely
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Check if we have any footer content
  const hasFooterContent = dueDate || attachments.length > 0 || assignees.length > 0

  return (
    <div
      className={`task-item ${isRequest ? 'task-item--request' : ''}`}
      onClick={() => onClick(task)}
    >
      {/* Request Badge */}
      {isRequest && requestedByDept && (
        <div className="task-item__request-badge">
          📨 Request from {DEPT_NAMES[requestedByDept] || requestedByDept}
        </div>
      )}
      
      {/* Header: Title + Priority */}
      <div className="task-item__header">
        <span className="task-item__title">{task.title}</span>
        <span className={`task-item__priority task-item__priority--${priority}`}>
          {priorityLabels[priority]}
        </span>
      </div>
      
      {/* Footer: Metadata + Assignees */}
      {hasFooterContent && (
        <div className="task-item__footer">
          <div className="task-item__meta">
            {dueDate && (
              <span className={`task-item__date ${isOverdue ? 'task-item__date--overdue' : ''}`}>
                📅 {formatDate(dueDate)}
              </span>
            )}
            
            {attachments.length > 0 && (
              <span className="task-item__attachments" title={`${attachments.length} attachment(s)`}>
                📎 {attachments.length}
              </span>
            )}
          </div>
          
          {assignees.length > 0 && (
            <div className="task-item__assignees">
              {assignees.slice(0, 2).map((user: any, idx: number) => (
                <span key={idx} className="task-item__avatar" title={getAssigneeName(user)}>
                  {getAssigneeName(user).charAt(0).toUpperCase()}
                </span>
              ))}
              {assignees.length > 2 && (
                <span className="task-item__avatar task-item__avatar--more">
                  +{assignees.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TaskCard

