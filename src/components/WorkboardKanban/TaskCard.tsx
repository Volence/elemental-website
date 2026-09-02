'use client'

import React from 'react'
import type { Task } from '@/payload-types'
import { Calendar, Paperclip, Send } from 'lucide-react'
import { dueDateKey, formatDueDate, localDateKey } from '@/utilities/taskDueDate'
import { getPostTypeColor } from '@/utilities/socialPostTypes'

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
  // Compare calendar days, not instants: date-only due dates are stored at UTC midnight
  const dueKey = dueDateKey(task.dueDate)
  const isOverdue = !!dueKey && dueKey < localDateKey(new Date()) && task.status !== 'complete'
  const postType = task.postType || null
  const platform = task.platform || null
  const priority = task.priority || 'medium'
  const isRequest = task.isRequest === true
  const requestedByDept = task.requestedByDepartment
  
  const getAssigneeName = (user: any): string => {
    if (typeof user === 'object' && user !== null) {
      return user.name || user.email || 'Unknown'
    }
    return 'Unknown'
  }

  // Check if we have any footer content
  const hasFooterContent = dueKey || attachments.length > 0 || assignees.length > 0

  return (
    <div
      className={`task-item ${isRequest ? 'task-item--request' : ''}`}
      onClick={() => onClick(task)}
    >
      {/* Request Badge */}
      {isRequest && requestedByDept && (
        <div className="task-item__request-badge">
          <Send size={12} /> Request from {DEPT_NAMES[requestedByDept] || requestedByDept}
        </div>
      )}
      
      {/* Header: Title + Priority */}
      <div className="task-item__header">
        <span className="task-item__title">{task.title}</span>
        <span className={`task-item__priority task-item__priority--${priority}`}>
          {priorityLabels[priority]}
        </span>
      </div>
      
      {/* Social media: post type / platform tags */}
      {(postType || platform) && (
        <div className="task-item__tags">
          {postType && (
            <span
              className="task-item__tag"
              style={{ color: getPostTypeColor(postType), borderColor: getPostTypeColor(postType) }}
            >
              {postType}
            </span>
          )}
          {platform && <span className="task-item__tag task-item__tag--muted">{platform}</span>}
        </div>
      )}
      
      {/* Footer: Metadata + Assignees */}
      {hasFooterContent && (
        <div className="task-item__footer">
          <div className="task-item__meta">
            {dueKey && (
              <span className={`task-item__date ${isOverdue ? 'task-item__date--overdue' : ''}`}>
                <Calendar size={14} /> {formatDueDate(task.dueDate)}
              </span>
            )}
            
            {attachments.length > 0 && (
              <span className="task-item__attachments" title={`${attachments.length} attachment(s)`}>
                <Paperclip size={12} /> {attachments.length}
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

