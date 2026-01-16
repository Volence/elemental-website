'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormModified, toast } from '@payloadcms/ui'
import { postScrimReminderAction } from '@/actions/post-scrim-reminder'

interface ReminderButtonProps {
  dayDate: string
  blockTime?: string
  hasOpponent: boolean
  reminderPosted?: boolean
  onReminderPosted: () => void
}

/**
 * Button component for posting scrim reminders to Discord
 * Extracted from ScheduleEditor for better code organization
 */
export const ReminderButton: React.FC<ReminderButtonProps> = ({ 
  dayDate, 
  blockTime,
  hasOpponent, 
  reminderPosted,
  onReminderPosted 
}) => {
  const { id } = useDocumentInfo()
  const isModified = useFormModified()
  const [isPosting, setIsPosting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (!id) return null

  const handlePost = async () => {
    setShowModal(false)
    setIsPosting(true)
    try {
      const result = await postScrimReminderAction(Number(id), dayDate, blockTime)
      if (result.success) {
        toast.success('Scrim reminder posted!')
        onReminderPosted()
      } else {
        toast.error(result.error || 'Failed to post reminder')
      }
    } catch (error) {
      toast.error('Error posting reminder')
    } finally {
      setIsPosting(false)
    }
  }

  // Disable if no opponent is set
  if (!hasOpponent) {
    return (
      <button
        type="button"
        className="schedule-editor__reminder-btn schedule-editor__reminder-btn--disabled"
        disabled
        title="Set an opponent first"
      >
        📣 Set opponent to post reminder
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`schedule-editor__reminder-btn ${reminderPosted ? 'schedule-editor__reminder-btn--posted' : ''}`}
        onClick={() => setShowModal(true)}
        disabled={isPosting}
      >
        {isPosting ? '📣 Posting...' : reminderPosted ? '✓ Reminder Posted' : '📣 Post Reminder'}
      </button>

      {showModal && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowModal(false)}>
          <div className="schedule-editor__modal schedule-editor__modal--reminder" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-editor__modal-header">
              <span className="schedule-editor__modal-icon">📣</span>
              <h3>Post Scrim Reminder</h3>
            </div>
            <div className="schedule-editor__modal-body">
              {isModified && (
                <p className="schedule-editor__modal-warning">
                  ⚠️ You have unsaved changes. Save first to ensure the latest info is posted.
                </p>
              )}
              <p>Post a reminder for <strong>{dayDate}</strong> to the <strong>Schedule thread</strong>?</p>
              {reminderPosted && (
                <p className="schedule-editor__modal-hint">Note: A reminder was already posted for this day.</p>
              )}
            </div>
            <div className="schedule-editor__modal-actions">
              <button
                type="button"
                className="schedule-editor__modal-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="schedule-editor__modal-confirm schedule-editor__modal-confirm--reminder"
                onClick={handlePost}
              >
                {reminderPosted ? 'Post Again' : 'Post Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
