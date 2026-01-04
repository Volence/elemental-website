'use client'

import React, { useState } from 'react'
import { Hash, Volume2, MessageSquare, Copy, Edit2, Save, X, Trash2, Copy as CopyIcon } from 'lucide-react'

interface Channel {
  id: string
  name: string
  type: number
  position: number
}

interface ChannelItemProps {
  channel: Channel
  categoryId: string
  onRename: (id: string, newName: string) => Promise<void>
  onDelete: (id: string, name: string) => void
  onClone: (id: string, name: string) => void
  onCopyId: (id: string, label: string) => void
  onRefresh: () => void
}

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  onRename,
  onDelete,
  onClone,
  onCopyId,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(channel.name)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (editValue && editValue !== channel.name) {
      setIsSaving(true)
      try {
        await onRename(channel.id, editValue)
        setIsEditing(false)
      } finally {
        setIsSaving(false)
      }
    } else {
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditValue(channel.name)
    setIsEditing(false)
  }

  const getChannelIcon = () => {
    if (channel.type === 2) return <Volume2 size={14} className="channel-type-icon" />
    if (channel.type === 15) return <MessageSquare size={14} className="channel-type-icon" />
    return <Hash size={14} className="channel-type-icon" />
  }

  return (
    <div className="channel-item">
      <div className="channel-content">
        {getChannelIcon()}
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            className="channel-name-input"
            autoFocus
            disabled={isSaving}
          />
        ) : (
          <span className="channel-name">{channel.name}</span>
        )}
      </div>
      <div className="channel-actions">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              className="action-btn-small save-btn"
              disabled={isSaving}
              title="Save"
            >
              <Save size={12} />
            </button>
            <button
              onClick={handleCancel}
              className="action-btn-small cancel-btn"
              disabled={isSaving}
              title="Cancel"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onCopyId(channel.id, 'Channel ID')}
              className="action-btn-small copy-btn"
              title="Copy Channel ID"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => {
                setEditValue(channel.name)
                setIsEditing(true)
              }}
              className="action-btn-small edit-btn"
              title="Rename Channel"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => onClone(channel.id, channel.name)}
              className="action-btn-small clone-btn"
              title="Clone Channel"
            >
              <CopyIcon size={12} />
            </button>
            <button
              onClick={() => onDelete(channel.id, channel.name)}
              className="action-btn-small delete-btn"
              title="Delete Channel"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
