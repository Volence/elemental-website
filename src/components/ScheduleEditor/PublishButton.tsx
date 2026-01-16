'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDocumentInfo, useFormModified, toast } from '@payloadcms/ui'
import { publishScheduleAction } from '@/actions/publish-schedule'

/**
 * Button component for publishing schedule to Discord
 * Extracted from ScheduleEditor for better code organization
 */
export const PublishButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const isModified = useFormModified()
  const [isPublishing, setIsPublishing] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (!id) return null

  const handlePublish = async () => {
    setShowModal(false)
    setIsPublishing(true)
    try {
      const result = await publishScheduleAction(Number(id))
      if (result.success) {
        toast.success('Schedule published to Discord!')
        // Refresh to update the calendarMessageId field in UI
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to publish')
      }
    } catch (error) {
      toast.error('Error publishing schedule')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="schedule-editor__publish-btn"
        onClick={() => setShowModal(true)}
        disabled={isPublishing}
      >
        {isPublishing ? '📤 Publishing...' : '📤 Publish to Discord'}
      </button>

      {showModal && (
        <div className="schedule-editor__modal-overlay" onClick={() => setShowModal(false)}>
          <div className="schedule-editor__modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-editor__modal-header">
              <span className="schedule-editor__modal-icon">📤</span>
              <h3>Publish Schedule</h3>
            </div>
            <div className="schedule-editor__modal-body">
              {isModified ? (
                <p className="schedule-editor__modal-warning">
                  ⚠️ <strong>Unsaved changes!</strong> Please save the document first before publishing. 
                  The publish action uses saved data from the database.
                </p>
              ) : (
                <p>This will post the schedule to the team's <strong>Calendar thread</strong> on Discord.</p>
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
                className="schedule-editor__modal-confirm"
                onClick={handlePublish}
                disabled={isModified}
                title={isModified ? 'Save your changes first' : 'Publish to Discord'}
              >
                {isModified ? '💾 Save First' : 'Publish to Discord'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
