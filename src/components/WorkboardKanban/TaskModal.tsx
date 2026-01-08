'use client'

import React, { useState, useEffect } from 'react'
import { useConfig } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'
import type { Task, User } from '@/payload-types'

interface TaskModalProps {
  task: Task | null
  department: string
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const STATUS_OPTIONS = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Review', value: 'review' },
  { label: 'Complete', value: 'complete' },
]

const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
]

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  department,
  isOpen,
  onClose,
  onSave,
}) => {
  const { config } = useConfig()
  const serverURL = config?.serverURL || ''
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'backlog',
    priority: 'medium',
    taskType: '',
    dueDate: '',
  })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([])
  
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: typeof task.description === 'string' ? task.description : '',
        status: task.status || 'backlog',
        priority: task.priority || 'medium',
        taskType: task.taskType || '',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      })
      setSelectedAssignees(
        (task.assignedTo || []).map((u: any) => (typeof u === 'number' ? u : u.id))
      )
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'backlog',
        priority: 'medium',
        taskType: '',
        dueDate: '',
      })
      setSelectedAssignees([])
    }
  }, [task])
  
  useEffect(() => {
    // Fetch users for assignment
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${serverURL}/api/users?limit=100`, {
          credentials: 'include',
        })
        const data = await res.json()
        setUsers(data.docs || [])
      } catch (err) {
        console.error('Failed to fetch users:', err)
      }
    }
    
    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen, serverURL])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }
    
    setSaving(true)
    
    try {
      const payload = {
        ...formData,
        department,
        assignedTo: selectedAssignees,
        dueDate: formData.dueDate || null,
      }
      
      const url = task
        ? `${serverURL}/api/tasks/${task.id}`
        : `${serverURL}/api/tasks`
      
      const res = await fetch(url, {
        method: task ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        toast.success(task ? 'Task updated!' : 'Task created!')
        onSave()
        onClose()
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save task')
      }
    } catch (err) {
      toast.error('Failed to save task')
    } finally {
      setSaving(false)
    }
  }
  
  const handleAssigneeToggle = (userId: number) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }
  
  if (!isOpen) return null
  
  return (
    <div className="workboard-modal-overlay" onClick={onClose}>
      <div className="workboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workboard-modal__header">
          <h2>{task ? 'Edit Task' : 'New Task'}</h2>
          <button className="workboard-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="workboard-modal__form">
          <div className="workboard-modal__field">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>
          
          <div className="workboard-modal__field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed requirements..."
              rows={4}
            />
          </div>
          
          <div className="workboard-modal__row">
            <div className="workboard-modal__field">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="workboard-modal__field">
              <label>Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="workboard-modal__field">
              <label>Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
          
          <div className="workboard-modal__field">
            <label>Assigned To</label>
            <div className="workboard-modal__assignees">
              {users.map((user) => (
                <label key={user.id} className="workboard-modal__assignee-option">
                  <input
                    type="checkbox"
                    checked={selectedAssignees.includes(user.id)}
                    onChange={() => handleAssigneeToggle(user.id)}
                  />
                  <span>{user.name || user.email}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="workboard-modal__actions">
            <button
              type="button"
              className="workboard-modal__btn workboard-modal__btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="workboard-modal__btn workboard-modal__btn--primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TaskModal
