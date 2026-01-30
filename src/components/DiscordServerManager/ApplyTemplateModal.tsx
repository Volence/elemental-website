'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Hash, Volume2, MessagesSquare, X, Lock } from 'lucide-react'

interface TemplateChannel {
  name: string
  type: number
}

interface ApplyTemplateModalProps {
  isOpen: boolean
  template: any | null
  categoryName: string
  isPrivate: boolean
  onClose: () => void
  onApply: (customizedData: { categoryName: string; channels: TemplateChannel[]; isPrivate: boolean }) => void
}

export const ApplyTemplateModal: React.FC<ApplyTemplateModalProps> = ({
  isOpen,
  template,
  categoryName,
  isPrivate,
  onClose,
  onApply
}) => {
  const [editedCategoryName, setEditedCategoryName] = useState(categoryName)
  const [editedChannels, setEditedChannels] = useState<TemplateChannel[]>([])
  const [isApplying, setIsApplying] = useState(false)
  const [isPrivateCategory, setIsPrivateCategory] = useState(isPrivate)

  useEffect(() => {
    if (template) {
      const templateData = template.templateData || template
      setEditedChannels(templateData.channels || [])
      // Use the saved category name from template as default
      // This allows users to set "T." as default and just add the team name
      const savedCategoryName = templateData.category?.name || template.sourceCategory || ''
      setEditedCategoryName(savedCategoryName)
      setIsPrivateCategory(isPrivate)
    }
  }, [template, isPrivate])

  const handleChannelNameChange = (index: number, newName: string) => {
    const updatedChannels = [...editedChannels]
    updatedChannels[index] = { ...updatedChannels[index], name: newName }
    setEditedChannels(updatedChannels)
  }

  const handleRemoveChannel = (index: number) => {
    const updatedChannels = editedChannels.filter((_, i) => i !== index)
    setEditedChannels(updatedChannels)
  }

  const handleApply = async () => {
    // Validation
    if (!editedCategoryName.trim()) {
      alert('Please enter a category name')
      return
    }

    if (editedChannels.length === 0) {
      if (!confirm('You have removed all channels. Create an empty category?')) {
        return
      }
    }

    setIsApplying(true)
    try {
      await onApply({
        categoryName: editedCategoryName,
        channels: editedChannels,
        isPrivate: isPrivateCategory
      })
      onClose()
    } finally {
      setIsApplying(false)
    }
  }

  const getChannelIcon = (type: number) => {
    switch (type) {
      case 0: return <Hash size={14} />
      case 2: return <Volume2 size={14} />
      case 15: return <MessagesSquare size={14} />
      default: return <Hash size={14} />
    }
  }

  const getChannelTypeName = (type: number) => {
    switch (type) {
      case 0: return 'Text'
      case 2: return 'Voice'
      case 15: return 'Forum'
      default: return 'Text'
    }
  }

  if (!template) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Customize: ${template.name}`}
      size="medium"
      footer={
        <>
          <button className="modal-button modal-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="modal-button modal-button-primary" 
            onClick={handleApply}
            disabled={isApplying || !editedCategoryName.trim()}
          >
            {isApplying ? 'Creating...' : 'Create Category'}
          </button>
        </>
      }
    >
      <div className="apply-template-form">
        <div className="form-section">
          <label className="form-label">
            Category Name *
          </label>
          <input
            type="text"
            className="form-input"
            value={editedCategoryName}
            onChange={(e) => setEditedCategoryName(e.target.value)}
            placeholder="e.g., ELMT Garden, Staff HQ"
            autoFocus
          />
          <p className="form-help">This will be the name of the Discord category</p>
        </div>

        <div className="form-section privacy-toggle">
          <label className="privacy-checkbox-label">
            <input
              type="checkbox"
              checked={isPrivateCategory}
              onChange={(e) => setIsPrivateCategory(e.target.checked)}
            />
            <Lock size={14} />
            <span>Make private (hide from @everyone)</span>
          </label>
        </div>

        <div className="form-section">
          <label className="form-label">
            Channels ({editedChannels.length})
          </label>
          <p className="form-help">Edit channel names before creating (e.g., add team name)</p>
          
          <div className="channels-edit-list">
            {editedChannels.length === 0 ? (
              <div className="no-channels-message">
                No channels will be created. Add channels from a template or create an empty category.
              </div>
            ) : (
              editedChannels.map((channel, index) => (
                <div key={index} className="channel-edit-row">
                  <div className="channel-type-indicator">
                    {getChannelIcon(channel.type)}
                    <span className="channel-type-label">{getChannelTypeName(channel.type)}</span>
                  </div>
                  <input
                    type="text"
                    className="channel-name-input"
                    value={channel.name}
                    onChange={(e) => handleChannelNameChange(index, e.target.value)}
                    placeholder="channel-name"
                  />
                  <button
                    className="remove-channel-button"
                    onClick={() => handleRemoveChannel(index)}
                    title="Remove this channel"
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
