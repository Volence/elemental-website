'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useConfig, useAuth } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'
import { ConfirmModal } from './ConfirmModal'
import type { Task, Person, Media } from '@/payload-types'
import { Calendar, Download, Paperclip, Save, Send, Trash2, Upload, X } from 'lucide-react'
import { dueDateInputValue, dueTimeInputValue, composeDueDate } from '@/utilities/taskDueDate'
import { lexicalToPlainText, plainTextToLexical } from '@/utilities/lexicalText'
import { formatRelative, getPersonLabel } from '@/admin-kit'
import { DEPT_NAMES, STATUS_OPTIONS, PRIORITY_OPTIONS } from './constants'
import { SOCIAL_POST_TYPES, SOCIAL_PLATFORMS } from '@/utilities/socialPostTypes'

interface TaskModalProps {
  task: Task | null
  department: string
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  isRequest?: boolean
  requestedByDepartment?: string
  /** Pre-fill the due date (YYYY-MM-DD) when creating from a calendar day */
  initialDueDate?: string
  /** Pre-fill other fields when creating (e.g. a promo post for an upcoming match) */
  initialValues?: Partial<{
    title: string
    description: string
    priority: string
    postType: string
    platform: string
  }>
}

interface AttachmentItem {
  file: number | Media | null
  label?: string | null
  id?: string | null
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  department,
  isOpen,
  onClose,
  onSave,
  isRequest = false,
  requestedByDepartment,
  initialDueDate,
  initialValues,
}) => {
  const { config } = useConfig()
  const { user: currentUser } = useAuth()
  const serverURL = config?.serverURL || ''
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'staff-manager'
  const [comments, setComments] = useState<NonNullable<Task['comments']>>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'backlog',
    priority: 'medium',
    taskType: '',
    dueDate: '',
    dueTime: '',
    addToGlobalCalendar: false,
    postType: '',
    platform: '',
    requestNotes: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [users, setUsers] = useState<Person[]>([])
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([])
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Reset the form whenever the modal opens or its subject changes
  useEffect(() => {
    if (!isOpen) return
    if (task) {
      setFormData({
        title: task.title || '',
        description: lexicalToPlainText(task.description),
        status: task.status || 'backlog',
        priority: task.priority || 'medium',
        taskType: task.taskType || '',
        dueDate: dueDateInputValue(task.dueDate),
        dueTime: dueTimeInputValue(task.dueDate),
        addToGlobalCalendar: task.addToGlobalCalendar || false,
        postType: task.postType || '',
        platform: task.platform || '',
        requestNotes: task.requestNotes || '',
      })
      setComments(task.comments || [])
      setNewComment('')
      setSelectedAssignees(
        (task.assignedTo || []).map((u: any) => (typeof u === 'number' ? u : u.id))
      )
      // Map attachments to ensure they match our interface (filter out undefined files)
      setAttachments(
        (task.attachments || [])
          .filter(att => att.file !== undefined)
          .map(att => ({
            file: att.file ?? null,
            label: att.label ?? null,
            id: att.id ?? null,
          }))
      )
    } else {
      setFormData({
        title: initialValues?.title || '',
        description: initialValues?.description || '',
        status: 'backlog',
        priority: initialValues?.priority || 'medium',
        taskType: '',
        dueDate: initialDueDate || '',
        dueTime: '',
        addToGlobalCalendar: false,
        postType: initialValues?.postType || '',
        platform: initialValues?.platform || '',
        requestNotes: '',
      })
      setSelectedAssignees([])
      setAttachments([])
      setComments([])
      setNewComment('')
    }
  }, [task, initialDueDate, initialValues, isOpen])

  useEffect(() => {
    // Fetch users for assignment - filtered by department
    const fetchUsers = async () => {
      try {
        // Map department to the corresponding staff field
        const departmentFieldMap: Record<string, string> = {
          'graphics': 'departments.isGraphicsStaff',
          'video': 'departments.isVideoStaff',
          'events': 'departments.isEventsStaff',
          'scouting': 'departments.isScoutingStaff',
          'production': 'departments.isProductionStaff',
          'social-media': 'departments.isSocialMediaStaff',
        }

        // An existing task keeps its owning department even when opened from the requester's board.
        const assigneeDepartment = task ? (task.department as string) : department
        const staffField = departmentFieldMap[assigneeDepartment]
        let url = `${serverURL}/api/people?limit=100`

        // Add department filter if we have a mapping
        if (staffField) {
          url += `&where[${encodeURIComponent(staffField)}][equals]=true`
        }

        const res = await fetch(url, {
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
  }, [isOpen, serverURL, department, task])

  // Upload file to Media collection
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('alt', file.name)

        const res = await fetch(`${serverURL}/api/media`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (res.ok) {
          const mediaDoc = await res.json()
          // Add to attachments list
          setAttachments(prev => [...prev, {
            file: mediaDoc.doc,
            label: file.name,
            id: `temp-${Date.now()}-${Math.random()}`,
          }])
          toast.success(`Uploaded: ${file.name}`)
        } else {
          toast.error(`Failed to upload: ${file.name}`)
        }
      }
    } catch (err) {
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Update attachment label/description
  const handleUpdateAttachmentLabel = (index: number, label: string) => {
    setAttachments(prev => prev.map((att, i) =>
      i === index ? { ...att, label } : att
    ))
  }

  // Get filename from attachment (uses filename, not label - label is for description)
  const getAttachmentFilename = (attachment: AttachmentItem): string => {
    if (typeof attachment.file === 'object' && attachment.file) {
      return attachment.file.filename || 'File'
    }
    return 'Attachment'
  }

  // Get label/description from attachment
  const getAttachmentLabel = (attachment: AttachmentItem): string => {
    return attachment.label || ''
  }

  // Get URL for attachment download/view
  const getAttachmentUrl = (attachment: AttachmentItem): string | null => {
    if (typeof attachment.file === 'object' && attachment.file) {
      return attachment.file.url || null
    }
    return null
  }

  // Check if attachment is an image
  const isImageAttachment = (attachment: AttachmentItem): boolean => {
    if (typeof attachment.file === 'object' && attachment.file) {
      const mimeType = attachment.file.mimeType || ''
      return mimeType.startsWith('image/')
    }
    return false
  }

  // Get thumbnail URL (use smaller size if available)
  const getThumbnailUrl = (attachment: AttachmentItem): string | null => {
    if (typeof attachment.file === 'object' && attachment.file) {
      // Check for thumbnail size first
      const sizes = attachment.file.sizes as any
      if (sizes?.thumbnail?.url) {
        return sizes.thumbnail.url
      }
      // Fall back to main URL
      return attachment.file.url || null
    }
    return null
  }

  // Existing tasks keep their own department; new ones take it from the board
  const effectiveDepartment = task ? (task.department as string) : department
  const isSocialMedia = effectiveDepartment === 'social-media'

  const handleSubmit = async () => {

    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }

    setSaving(true)

    try {
      // Build payload, excluding empty optional fields
      const payload: Record<string, any> = {
        title: formData.title,
        // The collection field is richText; round-trip through a minimal Lexical doc.
        description: plainTextToLexical(formData.description),
        status: formData.status,
        priority: formData.priority,
        department,
        assignedTo: selectedAssignees,
        dueDate: composeDueDate(formData.dueDate, formData.dueTime),
        // Calendar visibility
        addToGlobalCalendar: formData.addToGlobalCalendar,
        // Include attachments - extract just the file ID
        attachments: attachments.map(att => ({
          file: typeof att.file === 'object' && att.file ? att.file.id : att.file,
          label: att.label || undefined,
        })),
        // Request tracking fields
        isRequest: isRequest || undefined,
        requestedByDepartment: requestedByDepartment || undefined,
        requestNotes: (isRequest || task?.isRequest) ? (formData.requestNotes || null) : undefined,
      }

      // When editing an existing task, preserve its original department
      // Only set department from prop when creating a new task
      if (task) {
        // For existing tasks, use the task's current department
        payload.department = task.department
      }

      // Only include taskType if it has a value
      if (formData.taskType) {
        payload.taskType = formData.taskType
      }

      // Social media tasks carry post type + platform for the content calendar
      if (isSocialMedia) {
        payload.postType = formData.postType || null
        payload.platform = formData.platform || null
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

  // Delete task
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!task) return

    setShowDeleteConfirm(false)
    setSaving(true)
    try {
      const res = await fetch(`${serverURL}/api/tasks/${task.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (res.ok) {
        toast.success('Task deleted')
        onSave()
        onClose()
      } else {
        toast.error('Failed to delete task')
      }
    } catch (err) {
      toast.error('Failed to delete task')
    } finally {
      setSaving(false)
    }
  }

  // Archive/Unarchive task
  const handleArchive = async () => {
    if (!task) return

    const isArchiving = !task.archived

    setSaving(true)
    try {
      const res = await fetch(`${serverURL}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archived: isArchiving }),
      })

      if (res.ok) {
        toast.success(isArchiving ? 'Task archived' : 'Task unarchived')
        onSave()
        onClose()
      } else {
        toast.error('Failed to update task')
      }
    } catch (err) {
      toast.error('Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  const postComment = async () => {
    if (!task || !currentUser || !newComment.trim()) return
    setPostingComment(true)
    try {
      const existing = comments.map((c) => ({
        author: typeof c.author === 'object' && c.author ? c.author.id : c.author,
        content: c.content,
        createdAt: c.createdAt,
      }))
      const res = await fetch(`${serverURL}/api/tasks/${task.id}?depth=1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comments: [...existing, { author: currentUser.id, content: newComment.trim() }] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.errors?.[0]?.message || err?.message || 'Could not post comment')
        return
      }
      const data = await res.json()
      setComments(data?.doc?.comments || [])
      setNewComment('')
      onSave()
    } catch {
      toast.error('Could not post comment')
    } finally {
      setPostingComment(false)
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
          <div className="workboard-modal__header-title">
            <h2>{task ? 'Edit Task' : isRequest ? <><Send size={12} /> New Request</> : 'New Task'}</h2>
            {isRequest && requestedByDepartment && (
              <span className="workboard-modal__request-badge">
                Request from {DEPT_NAMES[requestedByDepartment] || requestedByDepartment}
              </span>
            )}
          </div>
          <button className="workboard-modal__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Using div instead of form to avoid nested form error with Payload */}
        <div className="workboard-modal__form">
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
              <label>Due date</label>
              <div className="workboard-modal__due">
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  aria-label="Due date"
                />
                <input
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                  aria-label="Due time (optional)"
                  disabled={!formData.dueDate}
                  title={formData.dueDate ? 'Optional time of day' : 'Pick a date first'}
                />
              </div>
            </div>
          </div>

          {/* Post details - only for Social Media department */}
          {isSocialMedia && (
            <div className="workboard-modal__row">
              <div className="workboard-modal__field">
                <label>Post Type</label>
                <select
                  value={formData.postType}
                  onChange={(e) => setFormData({ ...formData, postType: e.target.value })}
                >
                  <option value="">Not set</option>
                  {SOCIAL_POST_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="workboard-modal__field">
                <label>Platform</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                >
                  <option value="">Not set</option>
                  {SOCIAL_PLATFORMS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Show on Public Calendar - only for Events department */}
          {effectiveDepartment === 'events' && (
            <div className="workboard-modal__field workboard-modal__field--calendar-toggle">
              <label className="workboard-modal__calendar-toggle">
                <input
                  type="checkbox"
                  checked={formData.addToGlobalCalendar}
                  onChange={(e) => setFormData({ ...formData, addToGlobalCalendar: e.target.checked })}
                />
                <span><Calendar size={14} /> Show on Public Calendar</span>
              </label>
              <small>When enabled, this event will appear on the public calendar and Discord</small>
            </div>
          )}

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

          {(isRequest || task?.isRequest) && (
            <div className="workboard-modal__field">
              <label>Notes for the other department</label>
              <textarea
                value={formData.requestNotes}
                onChange={(e) => setFormData({ ...formData, requestNotes: e.target.value })}
                placeholder="Context, references, deadlines, who to contact..."
                rows={3}
              />
            </div>
          )}

          {task && (
            <div className="workboard-modal__field">
              <label>Comments {comments.length > 0 && `(${comments.length})`}</label>
              <div className="workboard-modal__comments">
                {comments.length === 0 && <p className="workboard-modal__comments-empty">No comments yet.</p>}
                {comments.map((c, idx) => (
                  <div key={c.id ?? idx} className="workboard-modal__comment">
                    <div className="workboard-modal__comment-meta">
                      <span className="workboard-modal__comment-author">{getPersonLabel(c.author as any)}</span>
                      <span className="workboard-modal__comment-time">{formatRelative(c.createdAt)}</span>
                    </div>
                    <p className="workboard-modal__comment-body">{c.content}</p>
                  </div>
                ))}
                <div className="workboard-modal__comment-form">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    aria-label="New comment"
                  />
                  <button
                    type="button"
                    className="workboard-modal__btn workboard-modal__btn--secondary"
                    disabled={postingComment || !newComment.trim()}
                    onClick={postComment}
                  >
                    {postingComment ? 'Posting...' : 'Post comment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div className="workboard-modal__field">
            <label>Attachments</label>
            <div className="workboard-modal__attachments">
              {/* Existing attachments */}
              {attachments.length > 0 && (
                <div className="workboard-modal__attachment-list">
                  {attachments.map((att, idx) => {
                    const url = getAttachmentUrl(att)
                    const isImage = isImageAttachment(att)
                    const thumbUrl = getThumbnailUrl(att)

                    return (
                      <div key={att.id || idx} className="workboard-modal__attachment-item">
                        {/* Image thumbnail or file icon */}
                        {isImage && thumbUrl ? (
                          <a
                            href={url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="workboard-modal__attachment-thumb"
                          >
                            <img src={thumbUrl} alt={getAttachmentFilename(att)} />
                          </a>
                        ) : (
                          <span className="workboard-modal__attachment-icon"><Paperclip size={12} /></span>
                        )}

                        {/* File info section */}
                        <div className="workboard-modal__attachment-info">
                          {/* Filename row with Save button */}
                          <div className="workboard-modal__attachment-row">
                            <span className="workboard-modal__attachment-name">
                              {getAttachmentFilename(att)}
                            </span>
                            {url && (
                              <a
                                href={url}
                                download={getAttachmentFilename(att)}
                                className="workboard-modal__attachment-download"
                                title="Download file"
                              >
                                <Save size={12} /> Save
                              </a>
                            )}
                          </div>

                          {/* Description input */}
                          <input
                            type="text"
                            placeholder="Add description..."
                            value={getAttachmentLabel(att)}
                            onChange={(e) => handleUpdateAttachmentLabel(idx, e.target.value)}
                            className="workboard-modal__attachment-desc"
                          />
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          className="workboard-modal__attachment-remove"
                          onClick={() => handleRemoveAttachment(idx)}
                          title="Remove attachment"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Upload button */}
              <div className="workboard-modal__upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="workboard-modal__file-input"
                  id="attachment-upload"
                />
                <label
                  htmlFor="attachment-upload"
                  className="workboard-modal__upload-btn"
                >
                  {uploading ? 'Uploading...' : '+ Add Files'}
                </label>
              </div>
            </div>
          </div>

          <div className="workboard-modal__actions">
            {/* Left side: Danger actions (only for existing tasks) */}
            {task && (
              <div className="workboard-modal__danger-actions">
                {canDelete && (
                  <button
                    type="button"
                    className="workboard-modal__btn workboard-modal__btn--danger"
                    disabled={saving}
                    onClick={handleDeleteClick}
                    title="Delete this task permanently (admins and staff managers)"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <button
                  type="button"
                  className="workboard-modal__btn workboard-modal__btn--archive"
                  disabled={saving}
                  onClick={handleArchive}
                  title={task.archived ? 'Unarchive this task' : 'Archive this task'}
                >
                  {task.archived ? <><Upload size={12} /> Unarchive</> : <><Download size={12} /> Archive</>}
                </button>
              </div>
            )}

            {/* Right side: Primary actions */}
            <div className="workboard-modal__primary-actions">
              <button
                type="button"
                className="workboard-modal__btn workboard-modal__btn--secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="workboard-modal__btn workboard-modal__btn--primary"
                disabled={saving || uploading}
                onClick={handleSubmit}
              >
                {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

export default TaskModal
