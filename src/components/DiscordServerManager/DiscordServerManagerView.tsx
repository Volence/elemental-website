'use client'

import React, { useState, useEffect } from 'react'
import { AlertModal, ConfirmModal } from './Modal'
import { EditTemplateModal } from './EditTemplateModal'
import { ApplyTemplateModal } from './ApplyTemplateModal'
import { CreateChannelModal } from './CreateChannelModal'
import { CategoryItem } from './CategoryItem'
import { Edit, Trash2 } from 'lucide-react'

interface DiscordChannel {
  id: string
  name: string
  type: number
  position: number
  parentId?: string | null
}

interface DiscordCategory {
  id: string
  name: string
  position: number
  channels: DiscordChannel[]
}

interface ServerStructure {
  categories: DiscordCategory[]
  uncategorized: DiscordChannel[]
  roles: any[]
  memberCount: number
}

interface ServerStats {
  channels: {
    total: number
    text: number
    voice: number
    announcement: number
    categories: number
  }
  roles: {
    total: number
  }
  members: {
    total: number
    humans: number
    bots: number
    online: number
  }
  server: {
    name: string
    createdAt: string
    premiumTier: number
    boosts: number
  }
}

interface HealthIssue {
  type: 'warning' | 'error' | 'info'
  category: string
  message: string
  suggestion?: string
}

interface ServerHealth {
  score: number
  status: 'excellent' | 'good' | 'fair' | 'poor'
  issues: HealthIssue[]
  summary: {
    errors: number
    warnings: number
    info: number
  }
}

interface Template {
  id: string
  name: string
  description?: string
  sourceCategory: string
  channelCount: number
  createdAt: string
}

const DiscordServerManagerView = () => {
  const [structure, setStructure] = useState<ServerStructure | null>(null)
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [health, setHealth] = useState<ServerHealth | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'structure' | 'stats' | 'health' | 'templates'>('structure')
  
  // Template form state
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isPrivateCategory, setIsPrivateCategory] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [applyTemplateModal, setApplyTemplateModal] = useState<{ isOpen: boolean; template: any | null }>({
    isOpen: false,
    template: null
  })
  
  // Modal state
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' | 'info' | 'warning' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; confirmType?: 'success' | 'danger' | 'warning' }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmType: 'success'
  })
  const [editTemplateModal, setEditTemplateModal] = useState<{ isOpen: boolean; template: any | null }>({
    isOpen: false,
    template: null
  })
  const [createChannelModal, setCreateChannelModal] = useState<{ isOpen: boolean; categoryId: string; categoryName: string }>({
    isOpen: false,
    categoryId: '',
    categoryName: ''
  })

  useEffect(() => {
    loadServerStructure()
  }, [])

  useEffect(() => {
    if (activeTab === 'stats' && !stats) {
      loadServerStats()
    } else if (activeTab === 'health' && !health) {
      loadServerHealth()
    } else if (activeTab === 'templates' && templates.length === 0) {
      loadTemplates()
    }
  }, [activeTab])

  const loadServerStructure = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/discord/server/structure')
      if (!response.ok) {
        throw new Error('Failed to load server structure')
      }
      const data = await response.json()
      setStructure(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadServerStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/discord/server/stats')
      if (!response.ok) {
        throw new Error('Failed to load server statistics')
      }
      const data = await response.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadServerHealth = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/discord/server/health')
      if (!response.ok) {
        throw new Error('Failed to load server health')
      }
      const data = await response.json()
      setHealth(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/discord-category-templates?limit=100')
      if (!response.ok) {
        throw new Error('Failed to load templates')
      }
      const data = await response.json()
      setTemplates(data.docs || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!selectedCategoryId || !templateName) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select a category and enter a template name',
        type: 'warning'
      })
      return
    }

    try {
      setSavingTemplate(true)
      const response = await fetch('/api/discord/templates/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          templateName,
          templateDescription,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save template')
      }

      // Clear form and reload templates
      setSelectedCategoryId('')
      setTemplateName('')
      setTemplateDescription('')
      await loadTemplates()
      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Template saved successfully!',
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleApplyTemplate = () => {
    if (!selectedTemplateId || !newCategoryName) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select a template and enter a category name',
        type: 'warning'
      })
      return
    }

    // Find the selected template
    const template = templates.find(t => t.id === selectedTemplateId)
    if (!template) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Selected template not found',
        type: 'error'
      })
      return
    }

    // Open the apply template modal for customization
    setApplyTemplateModal({
      isOpen: true,
      template
    })
  }

  const handleConfirmApplyTemplate = async (customizedData: { categoryName: string; channels: any[]; isPrivate: boolean }) => {
    try {
      setApplyingTemplate(true)
      const response = await fetch('/api/discord/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          categoryName: customizedData.categoryName,
          isPrivate: customizedData.isPrivate,
          customizedChannels: customizedData.channels, // Send customized channels
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to apply template')
      }

      const result = await response.json()
      setSelectedTemplateId('')
      setNewCategoryName('')
      setIsPrivateCategory(false)
      setApplyTemplateModal({ isOpen: false, template: null })
      
      // Reload server structure to show new category
      await loadServerStructure()
      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: `Created category "${result.category.name}" with ${result.channels.length} channels`,
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
    } finally {
      setApplyingTemplate(false)
    }
  }

  const handleEditTemplate = (template: any) => {
    setEditTemplateModal({
      isOpen: true,
      template
    })
  }

  const handleSaveEditedTemplate = async (editedTemplate: any) => {
    try {
      const response = await fetch('/api/discord/templates/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: editedTemplate.id,
          name: editedTemplate.name,
          description: editedTemplate.description,
          roles: editedTemplate.roles,
          channels: editedTemplate.channels,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update template')
      }

      await loadTemplates()
      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Template updated successfully!',
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
    }
  }

  const handleDeleteTemplate = (template: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Template',
      message: `Are you sure you want to delete the template "${template.name}"? This action cannot be undone.`,
      confirmType: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/discord/templates/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId: template.id }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to delete template')
          }

          await loadTemplates()
          if (selectedTemplateId === template.id) {
            setSelectedTemplateId('')
          }
          setAlertModal({
            isOpen: true,
            title: 'Success',
            message: 'Template deleted successfully!',
            type: 'success'
          })
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: err.message,
            type: 'error'
          })
        }
      }
    })
  }

  // Server Structure Management Handlers
  const handleRenameCategory = async (id: string, newName: string) => {
    try {
      const response = await fetch('/api/discord/server/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newName, type: 'category' }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rename category')
      }

      await loadServerStructure()
      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Category renamed successfully!',
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
      throw err
    }
  }

  const handleDeleteCategory = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete the category "${name}"? All channels in this category will also be deleted. This action cannot be undone.`,
      confirmType: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/discord/server/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, type: 'category' }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to delete category')
          }

          await loadServerStructure()
          setAlertModal({
            isOpen: true,
            title: 'Success',
            message: 'Category deleted successfully!',
            type: 'success'
          })
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: err.message,
            type: 'error'
          })
        }
      }
    })
  }

  const handleCopyId = (id: string, label: string) => {
    navigator.clipboard.writeText(id)
    setAlertModal({
      isOpen: true,
      title: 'Copied!',
      message: `${label} copied to clipboard`,
      type: 'success'
    })
  }

  const handleSaveCategoryAsTemplate = async (categoryId: string, categoryName: string) => {
    setSelectedCategoryId(categoryId)
    setTemplateName(`${categoryName} Template`)
    setTemplateDescription(`Template created from ${categoryName}`)
    // Switch to templates tab
    setActiveTab('templates')
  }

  const handleCreateChannel = (categoryId: string) => {
    // Find the category name for display
    const category = structure?.categories.find(c => c.id === categoryId)
    setCreateChannelModal({
      isOpen: true,
      categoryId,
      categoryName: category?.name || ''
    })
  }

  const handleConfirmCreateChannel = async (channelName: string, channelType: number) => {
    const { categoryId } = createChannelModal
    
    try {
      const response = await fetch('/api/discord/server/create-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: channelName, 
          type: channelType,
          parentId: categoryId 
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create channel')
      }

      await loadServerStructure()
      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: `Channel "${channelName}" created successfully!`,
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
      throw err // Re-throw to let modal handle it
    }
  }

  const handleRenameChannel = async (id: string, newName: string) => {
    try {
      const response = await fetch('/api/discord/server/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newName, type: 'channel' }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rename channel')
      }

      await loadServerStructure()
      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Channel renamed successfully!',
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
      throw err
    }
  }

  const handleDeleteChannel = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Channel',
      message: `Are you sure you want to delete the channel "${name}"? This action cannot be undone.`,
      confirmType: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/discord/server/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, type: 'channel' }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to delete channel')
          }

          await loadServerStructure()
          setAlertModal({
            isOpen: true,
            title: 'Success',
            message: 'Channel deleted successfully!',
            type: 'success'
          })
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: err.message,
            type: 'error'
          })
        }
      }
    })
  }

  const handleCloneChannel = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Clone Channel',
      message: `Clone the channel "${name}"?`,
      confirmType: 'success',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/discord/server/clone-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: id }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to clone channel')
          }

          await loadServerStructure()
          setAlertModal({
            isOpen: true,
            title: 'Success',
            message: `Channel "${name}" cloned successfully!`,
            type: 'success'
          })
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: err.message,
            type: 'error'
          })
        }
      }
    })
  }

  const handleReorderCategories = async (fromIndex: number, toIndex: number) => {
    if (!structure) return
    
    try {
      const category = structure.categories[fromIndex]
      
      // Use toIndex as the new position directly
      const newPosition = toIndex

      const response = await fetch('/api/discord/server/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: category.id, 
          position: newPosition,
          type: 'category'
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reorder category')
      }

      await loadServerStructure()
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
    }
  }

  const handleReorderChannels = async (categoryId: string, fromIndex: number, toIndex: number) => {
    if (!structure) return
    
    const category = structure.categories.find(c => c.id === categoryId)
    if (!category) return

    try {
      const channel = category.channels[fromIndex]
      
      // Use toIndex as the new position directly
      const newPosition = toIndex

      const response = await fetch('/api/discord/server/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: channel.id, 
          position: newPosition,
          parentId: categoryId,
          type: 'channel'
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reorder channel')
      }

      await loadServerStructure()
      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Channel reordered successfully!',
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      })
    }
  }

  return (
    <div className="discord-server-manager">
      <div className="manager-header">
        <div className="server-info">
          {structure && (
            <span className="member-count">
              {structure.memberCount} members
            </span>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'structure' ? 'active' : ''}`}
          onClick={() => setActiveTab('structure')}
          disabled={loading}
        >
          Server Structure
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
          disabled={loading}
        >
          Statistics
        </button>
        <button
          className={`tab ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
          disabled={loading}
        >
          Health Check
        </button>
        <button
          className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
          disabled={loading}
        >
          Templates
        </button>
      </div>

      <div className="tab-content">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p className="error-message">Error: {error}</p>
            <button onClick={loadServerStructure} className="retry-button">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
        {activeTab === 'structure' && structure && (
          <div className="server-structure">
            <div className="structure-header">
              <h3>Categories & Channels ({structure.memberCount.toLocaleString()} members)</h3>
              <button onClick={loadServerStructure} className="refresh-button">
                Refresh
              </button>
            </div>

            <div className="categories-list">
              {structure.categories.map((category, index) => (
                <CategoryItem
                  key={category.id}
                  category={category}
                  index={index}
                  onRename={handleRenameCategory}
                  onDelete={handleDeleteCategory}
                  onCopyId={handleCopyId}
                  onSaveAsTemplate={handleSaveCategoryAsTemplate}
                  onCreateChannel={handleCreateChannel}
                  onChannelRename={handleRenameChannel}
                  onChannelDelete={handleDeleteChannel}
                  onChannelClone={handleCloneChannel}
                  onChannelCopyId={handleCopyId}
                  onRefresh={loadServerStructure}
                  onReorder={handleReorderCategories}
                  onChannelReorder={handleReorderChannels}
                />
              ))}
            </div>

            {structure.uncategorized.length > 0 && (
              <div className="uncategorized-section">
                <h3>Uncategorized Channels ({structure.uncategorized.length})</h3>
                <div className="channels-container">
                  {structure.uncategorized.map((channel) => (
                    <div key={channel.id} className="channel-item">
                      <div className="channel-content">
                        <span className="channel-icon">
                          {channel.type === 0 ? '#' : channel.type === 2 ? '🔊' : '📄'}
                        </span>
                        <span className="channel-name">{channel.name}</span>
                      </div>
                      <div className="channel-actions">
                        <button
                          onClick={() => handleCopyId(channel.id, 'Channel ID')}
                          className="action-btn-small copy-btn"
                          title="Copy Channel ID"
                        >
                          Copy ID
                        </button>
                        <button
                          onClick={() => handleDeleteChannel(channel.id, channel.name)}
                          className="action-btn-small delete-btn"
                          title="Delete Channel"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="stats-view">
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Channels</h4>
                <div className="stat-main">{stats.channels.total}</div>
                <div className="stat-breakdown">
                  <div className="stat-item">
                    <span className="stat-label"># Text:</span>
                    <span className="stat-value">{stats.channels.text}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">🔊 Voice:</span>
                    <span className="stat-value">{stats.channels.voice}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">📢 Announcements:</span>
                    <span className="stat-value">{stats.channels.announcement}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">📁 Categories:</span>
                    <span className="stat-value">{stats.channels.categories}</span>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <h4>Members</h4>
                <div className="stat-main">{stats.members.total}</div>
                <div className="stat-breakdown">
                  <div className="stat-item">
                    <span className="stat-label">👤 Humans:</span>
                    <span className="stat-value">{stats.members.humans}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">🤖 Bots:</span>
                    <span className="stat-value">{stats.members.bots}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">🟢 Online:</span>
                    <span className="stat-value">{stats.members.online}</span>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <h4>Roles</h4>
                <div className="stat-main">{stats.roles.total}</div>
                <div className="stat-breakdown">
                  <div className="stat-item">
                    <span className="stat-label">Custom roles</span>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <h4>Server Boosts</h4>
                <div className="stat-main">{stats.server.boosts}</div>
                <div className="stat-breakdown">
                  <div className="stat-item">
                    <span className="stat-label">Tier {stats.server.premiumTier}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="templates-view">
            <div className="templates-header">
              <div>
                <h3>Category Templates</h3>
                <p>Save category configurations for quick reuse across teams</p>
              </div>
            </div>

            <div className="templates-grid">
              {/* Save Template Section */}
              <div className="template-section">
                <h4>💾 Save New Template</h4>
                <p>Select a category from your server to save as a template:</p>
                
                <div className="form-field">
                  <label>Category</label>
                  <select 
                    className="category-select"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                  >
                    <option value="">Select a category...</option>
                    {structure?.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.channels.length} channels)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Template Name *</label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="e.g., Team Channels, Staff Category"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Description (optional)</label>
                  <textarea
                    className="textarea-input"
                    placeholder="What is this template for?"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <button 
                  className="save-template-button"
                  onClick={handleSaveTemplate}
                  disabled={!selectedCategoryId || !templateName || savingTemplate}
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>

                <p className="help-text">
                  💡 Templates save the category structure, channel names, types, and permissions
                </p>
              </div>

              {/* Apply Template Section */}
              <div className="template-section">
                <h4>📁 Saved Templates ({templates.length})</h4>
                
                {templates.length === 0 ? (
                  <p>No templates saved yet. Save a category to get started!</p>
                ) : (
                  <>
                    <div className="templates-list">
                      {templates.map((template) => (
                        <div 
                          key={template.id} 
                          className={`template-card ${selectedTemplateId === template.id ? 'selected' : ''}`}
                        >
                          <div 
                            className="template-card-body"
                            onClick={() => setSelectedTemplateId(template.id)}
                          >
                            <div className="template-card-header">
                              <h5>{template.name}</h5>
                              <span className="template-channels">{template.channelCount} channels</span>
                            </div>
                            {template.description && (
                              <p className="template-description">{template.description}</p>
                            )}
                            <p className="template-source">From: {template.sourceCategory}</p>
                          </div>
                          <div className="template-card-actions">
                            <button
                              className="template-action-button edit-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditTemplate(template)
                              }}
                              title="Edit template"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="template-action-button delete-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTemplate(template)
                              }}
                              title="Delete template"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedTemplateId && (
                      <div className="apply-template-form">
                        <h5>Create Category from Template</h5>
                        
                        <div className="form-field">
                          <label>New Category Name *</label>
                          <input
                            type="text"
                            className="text-input"
                            placeholder="e.g., ELMT Garden, Staff HQ"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                          />
                        </div>

                        <div className="form-field checkbox-field">
                          <label>
                            <input
                              type="checkbox"
                              checked={isPrivateCategory}
                              onChange={(e) => setIsPrivateCategory(e.target.checked)}
                            />
                            <span>Make private (hide from @everyone)</span>
                          </label>
                        </div>

                        <button
                          className="apply-template-button"
                          onClick={handleApplyTemplate}
                          disabled={applyingTemplate}
                        >
                          {applyingTemplate ? 'Creating...' : 'Create Category'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && health && (
          <div className="health-view">
            <div className="health-header">
              <div className="health-score-card">
                <div className="health-score">
                  <div className={`score-circle ${health.status}`}>
                    <span className="score-number">{health.score}</span>
                    <span className="score-label">/ 100</span>
                  </div>
                  <div className="health-status">
                    <h3>{health.status.charAt(0).toUpperCase() + health.status.slice(1)}</h3>
                    <p>Server Health</p>
                  </div>
                </div>
                <div className="health-summary">
                  {health.summary.errors > 0 && (
                    <div className="summary-item error">
                      <span className="count">{health.summary.errors}</span>
                      <span className="label">Errors</span>
                    </div>
                  )}
                  {health.summary.warnings > 0 && (
                    <div className="summary-item warning">
                      <span className="count">{health.summary.warnings}</span>
                      <span className="label">Warnings</span>
                    </div>
                  )}
                  {health.summary.info > 0 && (
                    <div className="summary-item info">
                      <span className="count">{health.summary.info}</span>
                      <span className="label">Info</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="health-issues">
              <h4>Issues & Recommendations</h4>
              {health.issues.length === 0 ? (
                <div className="no-issues">
                  <p>✅ No issues found! Your server is in great shape.</p>
                </div>
              ) : (
                <div className="issues-list">
                  {health.issues.map((issue, idx) => (
                    <div key={idx} className={`issue-card ${issue.type}`}>
                      <div className="issue-header">
                        <span className={`issue-badge ${issue.type}`}>
                          {issue.type === 'error' ? '🔴' : issue.type === 'warning' ? '⚠️' : 'ℹ️'}
                          {issue.category}
                        </span>
                      </div>
                      <div className="issue-content">
                        <p className="issue-message">{issue.message}</p>
                        {issue.suggestion && (
                          <p className="issue-suggestion">💡 {issue.suggestion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* Modals */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmType={confirmModal.confirmType}
      />

      <EditTemplateModal
        isOpen={editTemplateModal.isOpen}
        template={editTemplateModal.template}
        onClose={() => setEditTemplateModal({ isOpen: false, template: null })}
        onSave={handleSaveEditedTemplate}
      />

      <ApplyTemplateModal
        isOpen={applyTemplateModal.isOpen}
        template={applyTemplateModal.template}
        categoryName={newCategoryName}
        isPrivate={isPrivateCategory}
        onClose={() => setApplyTemplateModal({ isOpen: false, template: null })}
        onApply={handleConfirmApplyTemplate}
      />

      <CreateChannelModal
        isOpen={createChannelModal.isOpen}
        categoryName={createChannelModal.categoryName}
        onClose={() => setCreateChannelModal({ isOpen: false, categoryId: '', categoryName: '' })}
        onConfirm={handleConfirmCreateChannel}
      />
    </div>
  )
}

export default DiscordServerManagerView
