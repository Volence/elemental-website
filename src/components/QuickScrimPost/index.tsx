'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormFields, toast } from '@payloadcms/ui'
import { postQuickScrimAction } from '@/actions/post-quick-scrim'

import './index.scss'

export const QuickScrimPost: React.FC<{ path: string }> = () => {
  const { id } = useDocumentInfo()
  const [isPosting, setIsPosting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  
  // Get posted status from form
  const postedField = useFormFields(([fields]) => fields['posted'])
  const isPosted = postedField?.value as boolean
  
  // Get opponent to check if ready to post
  const opponentField = useFormFields(([fields]) => fields['opponent'])
  const hasOpponent = Boolean(opponentField?.value)

  if (!id) {
    return (
      <div className="quick-scrim-post quick-scrim-post--unsaved">
        <p>Save the scrim first to enable posting</p>
      </div>
    )
  }

  const handlePost = async () => {
    setShowModal(false)
    setIsPosting(true)
    try {
      const result = await postQuickScrimAction(Number(id))
      if (result.success) {
        toast.success('Scrim posted to Discord!')
        // Reload to update posted status
        window.location.reload()
      } else {
        toast.error(result.error || 'Failed to post')
      }
    } catch (error) {
      toast.error('Error posting scrim')
    } finally {
      setIsPosting(false)
    }
  }

  if (!hasOpponent) {
    return (
      <div className="quick-scrim-post">
        <button
          type="button"
          className="quick-scrim-post__btn quick-scrim-post__btn--disabled"
          disabled
        >
          📣 Set opponent to post
        </button>
      </div>
    )
  }

  return (
    <div className="quick-scrim-post">
      <button
        type="button"
        className={`quick-scrim-post__btn ${isPosted ? 'quick-scrim-post__btn--posted' : ''}`}
        onClick={() => setShowModal(true)}
        disabled={isPosting}
      >
        {isPosting ? '📣 Posting...' : isPosted ? '✓ Posted to Discord' : '📣 Post to Discord'}
      </button>

      {showModal && (
        <div className="quick-scrim-post__modal-overlay" onClick={() => setShowModal(false)}>
          <div className="quick-scrim-post__modal" onClick={(e) => e.stopPropagation()}>
            <div className="quick-scrim-post__modal-header">
              <span className="quick-scrim-post__modal-icon">📣</span>
              <h3>Post Scrim Announcement</h3>
            </div>
            <div className="quick-scrim-post__modal-body">
              {isPosted && (
                <p className="quick-scrim-post__modal-warning">
                  ⚠️ This scrim was already posted. Posting again will send a new message.
                </p>
              )}
              <p>Post this scrim to the team's <strong>Schedule thread</strong>?</p>
              <p className="quick-scrim-post__modal-hint">Make sure you've saved any changes first!</p>
            </div>
            <div className="quick-scrim-post__modal-actions">
              <button
                type="button"
                className="quick-scrim-post__modal-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="quick-scrim-post__modal-confirm"
                onClick={handlePost}
              >
                {isPosted ? 'Post Again' : 'Post to Discord'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickScrimPost
