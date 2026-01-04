'use client'

import React, { useState } from 'react'
import { Modal } from './Modal'

interface CreateChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (name: string, type: number) => void
  categoryName?: string
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  categoryName
}) => {
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState(0) // 0 = text, 2 = voice, 15 = forum
  const [isCreating, setIsCreating] = useState(false)

  const handleConfirm = async () => {
    if (!channelName.trim()) {
      return
    }

    setIsCreating(true)
    try {
      await onConfirm(channelName.trim(), channelType)
      setChannelName('')
      setChannelType(0)
      onClose()
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setChannelName('')
    setChannelType(0)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Create Channel${categoryName ? ` in ${categoryName}` : ''}`}
      size="medium"
      footer={
        <>
          <button 
            className="modal-button modal-button-secondary" 
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button 
            className="modal-button modal-button-success"
            onClick={handleConfirm}
            disabled={!channelName.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Channel'}
          </button>
        </>
      }
    >
      <div className="create-channel-content">
        <div className="form-field">
          <label>Channel Name *</label>
          <input
            type="text"
            className="text-input"
            placeholder="e.g., general, announcements"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && channelName.trim()) {
                handleConfirm()
              }
            }}
            autoFocus
            disabled={isCreating}
          />
          <p className="help-text">
            Use lowercase letters, numbers, and hyphens only
          </p>
        </div>

        <div className="form-field">
          <label>Channel Type</label>
          <div className="channel-type-options">
            <label className={`channel-type-option ${channelType === 0 ? 'selected' : ''}`}>
              <input
                type="radio"
                name="channelType"
                value={0}
                checked={channelType === 0}
                onChange={() => setChannelType(0)}
                disabled={isCreating}
              />
              <span className="channel-type-label">
                <span className="channel-type-icon">#</span>
                <span>Text Channel</span>
              </span>
            </label>
            <label className={`channel-type-option ${channelType === 2 ? 'selected' : ''}`}>
              <input
                type="radio"
                name="channelType"
                value={2}
                checked={channelType === 2}
                onChange={() => setChannelType(2)}
                disabled={isCreating}
              />
              <span className="channel-type-label">
                <span className="channel-type-icon">🔊</span>
                <span>Voice Channel</span>
              </span>
            </label>
            <label className={`channel-type-option ${channelType === 15 ? 'selected' : ''}`}>
              <input
                type="radio"
                name="channelType"
                value={15}
                checked={channelType === 15}
                onChange={() => setChannelType(15)}
                disabled={isCreating}
              />
              <span className="channel-type-label">
                <span className="channel-type-icon">💬</span>
                <span>Forum Channel</span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  )
}
