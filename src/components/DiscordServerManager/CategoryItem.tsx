'use client'

import React, { useState } from 'react'
import { Layers, Copy, Edit2, Save, X, Trash2, FileText, Plus, GripVertical } from 'lucide-react'
import { ChannelItem } from './ChannelItem'

interface Channel {
  id: string
  name: string
  type: number
  position: number
}

interface Category {
  id: string
  name: string
  position: number
  channels: Channel[]
}

interface CategoryItemProps {
  category: Category
  index: number
  onRename: (id: string, newName: string) => Promise<void>
  onDelete: (id: string, name: string) => void
  onCopyId: (id: string, label: string) => void
  onSaveAsTemplate: (id: string, name: string) => void
  onCreateChannel: (categoryId: string) => void
  onChannelRename: (id: string, newName: string) => Promise<void>
  onChannelDelete: (id: string, name: string) => void
  onChannelClone: (id: string, name: string) => void
  onChannelCopyId: (id: string, label: string) => void
  onRefresh: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onChannelReorder: (categoryId: string, fromIndex: number, toIndex: number) => void
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  index,
  onRename,
  onDelete,
  onCopyId,
  onSaveAsTemplate,
  onCreateChannel,
  onChannelRename,
  onChannelDelete,
  onChannelClone,
  onChannelCopyId,
  onRefresh,
  onReorder,
  onChannelReorder,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(category.name)
  const [isSaving, setIsSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleSave = async () => {
    if (editValue && editValue !== category.name) {
      setIsSaving(true)
      try {
        await onRename(category.id, editValue)
        setIsEditing(false)
      } finally {
        setIsSaving(false)
      }
    } else {
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditValue(category.name)
    setIsEditing(false)
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('categoryIndex', index.toString())
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
    const fromIndex = parseInt(e.dataTransfer.getData('categoryIndex'))
    if (fromIndex !== index && !isNaN(fromIndex)) {
      onReorder(fromIndex, index)
    }
    setDragOver(false)
  }

  return (
    <div 
      className={`category-item ${isDragging ? 'dragging' : ''} ${dragOver ? 'drag-over' : ''}`}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="category-header-row">
        <div className="category-title">
          <GripVertical size={18} className="drag-handle" />
          <Layers size={18} className="category-icon" />
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              className="category-name-input"
              autoFocus
              disabled={isSaving}
            />
          ) : (
            <h4>{category.name}</h4>
          )}
          <span className="channel-count">{category.channels.length} channels</span>
        </div>
        <div className="category-actions">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="action-btn save-btn"
                disabled={isSaving}
                title="Save"
              >
                <Save size={14} />
              </button>
              <button
                onClick={handleCancel}
                className="action-btn cancel-btn"
                disabled={isSaving}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onCopyId(category.id, 'Category ID')}
                className="action-btn copy-btn"
                title="Copy Category ID"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => {
                  setEditValue(category.name)
                  setIsEditing(true)
                }}
                className="action-btn edit-btn"
                title="Rename Category"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onSaveAsTemplate(category.id, category.name)}
                className="action-btn template-btn"
                title="Save as Template"
              >
                <FileText size={14} />
              </button>
              <button
                onClick={() => onCreateChannel(category.id)}
                className="action-btn create-btn"
                title="Add Channel"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => onDelete(category.id, category.name)}
                className="action-btn delete-btn"
                title="Delete Category"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="channels-container">
        {category.channels.length === 0 ? (
          <div className="empty-channels">
            <p>No channels in this category</p>
            <button
              onClick={() => onCreateChannel(category.id)}
              className="add-channel-prompt"
            >
              <Plus size={14} /> Add Channel
            </button>
          </div>
        ) : (
          category.channels.map((channel, channelIndex) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              categoryId={category.id}
              index={channelIndex}
              onRename={onChannelRename}
              onDelete={onChannelDelete}
              onClone={onChannelClone}
              onCopyId={onChannelCopyId}
              onRefresh={onRefresh}
              onReorder={(fromIndex, toIndex) => onChannelReorder(category.id, fromIndex, toIndex)}
            />
          ))
        )}
      </div>
    </div>
  )
}
