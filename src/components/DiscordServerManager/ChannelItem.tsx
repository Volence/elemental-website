'use client'

import React, { useState } from 'react'
import { Hash, Volume2, MessageSquare, Copy, Edit2, Save, X, Trash2, Copy as CopyIcon, GripVertical } from 'lucide-react'

interface Channel {
  id: string
  name: string
  type: number
  position: number
}

interface ChannelItemProps {
  channel: Channel
  categoryId: string
  index: number
  onRename: (id: string, newName: string) => Promise<void>
  onDelete: (id: string, name: string) => void
  onClone: (id: string, name: string) => void
  onCopyId: (id: string, label: string) => void
  onRefresh: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  index,
  onRename,
  onDelete,
  onClone,
  onCopyId,
  onReorder,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(channel.name)
  const [isSaving, setIsSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)

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

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('channelIndex', index.toString())
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('channelIndex'))
    if (fromIndex !== index && !isNaN(fromIndex)) {
      onReorder(fromIndex, index)
    }
    setDragOver(false)
  }

  return (
    <div 
      className={`channel-item ${isDragging ? 'dragging' : ''} ${dragOver ? 'drag-over' : ''}`}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="channel-content">
        <GripVertical size={12} className="drag-handle" />
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
