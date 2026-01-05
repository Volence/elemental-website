'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Edit2, Hash, Volume2, MessageSquare } from 'lucide-react'

const COMMON_CATEGORY_PERMS = [
  'ViewChannel', 'SendMessages', 'ReadMessageHistory', 'Connect', 'Speak',
  'UseVAD', 'ManageMessages', 'EmbedLinks', 'AttachFiles', 'AddReactions',
  'UseExternalEmojis', 'UseExternalStickers', 'MentionEveryone', 'ManageThreads',
  'CreatePublicThreads', 'CreatePrivateThreads', 'SendMessagesInThreads',
  'UseApplicationCommands', 'SendPolls', 'CreatePosts'
]

interface TemplateChannel {
  name: string
  type: number
}

interface TemplateRole {
  id?: string // Discord role ID
  name: string
  permissions: Record<string, boolean>
}

interface EditedTemplate {
  id: string
  name: string
  description?: string
  roles: TemplateRole[]
  channels: TemplateChannel[]
}

interface EditTemplateModalProps {
  isOpen: boolean
  template: any | null
  onClose: () => void
  onSave: (template: EditedTemplate) => void
}

export const EditTemplateModal: React.FC<EditTemplateModalProps> = ({
  isOpen,
  template,
  onClose,
  onSave
}) => {
  const [editedTemplate, setEditedTemplate] = useState<EditedTemplate | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [serverRoles, setServerRoles] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [roleSearchTerm, setRoleSearchTerm] = useState('')
  const [showRoleSearch, setShowRoleSearch] = useState<number | null>(null) // Track which role index is searching
  const [showChannelTypeMenu, setShowChannelTypeMenu] = useState(false)

  // Load server roles when modal opens
  useEffect(() => {
    if (isOpen) {
      // Always reload roles when modal opens to ensure fresh data
      loadServerRoles()
    }
  }, [isOpen])

  const loadServerRoles = async () => {
    try {
      setLoadingRoles(true)
      
      // Use lightweight roles-only endpoint (much faster!)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const response = await fetch('/api/discord/server/roles', {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Failed to load server roles: ${response.status}`)
      }
      
      const data = await response.json()
      setServerRoles(data.roles || [])
    } catch (error: any) {
      console.error('Failed to load server roles:', error)
      setServerRoles([]) // Ensure it's set even on error
    } finally {
      setLoadingRoles(false)
    }
  }

  useEffect(() => {
    if (template) {
      // Extract data from templateData if it exists, otherwise use legacy structure
      const templateData = template.templateData || template
      
      setEditedTemplate({
        id: template.id,
        name: template.name,
        description: template.description || '',
        roles: templateData.roles || [],
        channels: templateData.channels || []
      })
    }
  }, [template])

  const handleSave = async () => {
    if (!editedTemplate) return
    setIsSaving(true)
    try {
      await onSave(editedTemplate)
      // Don't close modal - let user continue editing or manually close
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Channel handlers
  const handleAddChannel = (type: number = 0) => {
    if (!editedTemplate) return
    setEditedTemplate({
      ...editedTemplate,
      channels: [...editedTemplate.channels, { name: 'new-channel', type }]
    })
    setShowChannelTypeMenu(false)
  }

  const handleRemoveChannel = (index: number) => {
    if (!editedTemplate) return
    const newChannels = [...editedTemplate.channels]
    newChannels.splice(index, 1)
    setEditedTemplate({ ...editedTemplate, channels: newChannels })
  }

  const handleChannelNameChange = (index: number, name: string) => {
    if (!editedTemplate) return
    const newChannels = [...editedTemplate.channels]
    newChannels[index] = { ...newChannels[index], name }
    setEditedTemplate({ ...editedTemplate, channels: newChannels })
  }

  const handleMoveChannel = (index: number, direction: 'up' | 'down') => {
    if (!editedTemplate) return
    const newChannels = [...editedTemplate.channels]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newChannels.length) return
    ;[newChannels[index], newChannels[newIndex]] = [newChannels[newIndex], newChannels[index]]
    setEditedTemplate({ ...editedTemplate, channels: newChannels })
  }

  // Role handlers
  const handleAddRole = () => {
    if (!editedTemplate) return
    const newRoleIndex = editedTemplate.roles.length
    setEditedTemplate({
      ...editedTemplate,
      roles: [...editedTemplate.roles, { name: '', permissions: {} }] // Empty name triggers search
    })
    setShowRoleSearch(newRoleIndex) // Show search for the new role
    setRoleSearchTerm('') // Reset search term
  }

  const handleRemoveRole = (index: number) => {
    if (!editedTemplate) return
    const newRoles = [...editedTemplate.roles]
    newRoles.splice(index, 1)
    setEditedTemplate({ ...editedTemplate, roles: newRoles })
    if (showRoleSearch === index) {
      setShowRoleSearch(null)
      setRoleSearchTerm('')
    }
  }

  const handleRoleSelect = (index: number, roleId: string) => {
    if (!editedTemplate) return
    const selectedRole = serverRoles.find(r => r.id === roleId)
    if (!selectedRole) return
    
    const newRoles = [...editedTemplate.roles]
    newRoles[index] = { 
      ...newRoles[index], 
      id: selectedRole.id,
      name: selectedRole.name 
    }
    setEditedTemplate({ ...editedTemplate, roles: newRoles })
    setShowRoleSearch(null) // Hide search after selection
    setRoleSearchTerm('') // Reset search term
  }

  const handleChangeRole = (index: number) => {
    if (!editedTemplate) return
    const newRoles = [...editedTemplate.roles]
    // Clear the role selection to show search again
    newRoles[index] = { ...newRoles[index], id: undefined, name: '' }
    setEditedTemplate({ ...editedTemplate, roles: newRoles })
    setShowRoleSearch(index)
    setRoleSearchTerm('')
  }

  // Filter roles based on search term
  const getFilteredRoles = () => {
    if (!roleSearchTerm) return serverRoles

    const searchLower = roleSearchTerm.toLowerCase()
    return serverRoles.filter(role => 
      role.name.toLowerCase().includes(searchLower)
    )
  }

  // Get available roles (not already selected)
  const getAvailableRoles = () => {
    const selectedRoleIds = editedTemplate?.roles.map(r => r.id).filter(Boolean) || []
    return getFilteredRoles().filter(role => !selectedRoleIds.includes(role.id))
  }

  const handleRolePermissionChange = (roleIndex: number, perm: string, value: boolean) => {
    if (!editedTemplate) return
    const newRoles = [...editedTemplate.roles]
    const newPerms = { ...newRoles[roleIndex].permissions }
    if (value) {
      newPerms[perm] = true
    } else {
      delete newPerms[perm]
    }
    newRoles[roleIndex] = { ...newRoles[roleIndex], permissions: newPerms }
    setEditedTemplate({ ...editedTemplate, roles: newRoles })
  }

  if (!editedTemplate) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Category Template: ${editedTemplate.name}`}
      size="large"
      footer={
        <>
          <button className="modal-button modal-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="modal-button modal-button-success"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="edit-template-content">
        {/* Template Name */}
        <div className="form-field">
          <label>Template Name *</label>
          <input
            type="text"
            className="text-input"
            value={editedTemplate.name}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, name: e.target.value })}
          />
        </div>

        {/* Template Description */}
        <div className="form-field">
          <label>Description</label>
          <textarea
            className="textarea-input"
            value={editedTemplate.description}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, description: e.target.value })}
            rows={2}
          />
        </div>

        {/* Category Default Permissions */}
        <div className="template-section-edit">
          <div className="template-section-header">
            <h4>Category Default Permissions</h4>
            <button className="add-button" onClick={handleAddRole}>
              <Plus size={16} /> Add Role
            </button>
          </div>
          
          <div className="roles-list">
            {editedTemplate.roles.map((role, roleIndex) => (
              <div 
                key={roleIndex} 
                className={`role-edit-card ${showRoleSearch === roleIndex ? 'dropdown-open' : ''}`}
              >
                <div className="role-edit-header">
                  {role.name ? (
                    // Show selected role name with change button
                    <>
                      <div className="role-name-display">
                        <span className="role-name-text">{role.name}</span>
                        {role.id && serverRoles.find(r => r.id === role.id)?.color && (
                          <span 
                            className="role-color-dot" 
                            style={{ 
                              backgroundColor: serverRoles.find(r => r.id === role.id)?.color 
                            }}
                          />
                        )}
                      </div>
                      <button
                        className="change-role-button"
                        onClick={() => handleChangeRole(roleIndex)}
                        title="Change role"
                      >
                        <Edit2 size={14} />
                      </button>
                    </>
                  ) : (
                    // Show search input to select a role
                    <div className="role-search-container">
                      <input
                        type="text"
                        className="role-search-input"
                        placeholder={loadingRoles ? 'Loading roles...' : 'Search for a role...'}
                        value={roleSearchTerm}
                        onChange={(e) => setRoleSearchTerm(e.target.value)}
                        onFocus={() => setShowRoleSearch(roleIndex)}
                        disabled={loadingRoles}
                        autoFocus
                      />
                      {showRoleSearch === roleIndex && !loadingRoles && (
                        <div className="role-search-results">
                          {getAvailableRoles().length > 0 ? (
                            <>
                              {getAvailableRoles().slice(0, 10).map(serverRole => (
                                <div
                                  key={serverRole.id}
                                  className="role-search-result-item"
                                  onClick={() => handleRoleSelect(roleIndex, serverRole.id)}
                                >
                                  <span className="role-result-name">{serverRole.name}</span>
                                  {serverRole.color && (
                                    <span 
                                      className="role-color-dot" 
                                      style={{ backgroundColor: serverRole.color }}
                                    />
                                  )}
                                </div>
                              ))}
                              {getAvailableRoles().length > 10 && (
                                <div className="role-search-more">
                                  +{getAvailableRoles().length - 10} more roles (keep typing to filter)
                                </div>
                              )}
                            </>
                          ) : serverRoles.length === 0 ? (
                            <div className="role-search-no-results">
                              No roles available. All roles may already be selected.
                            </div>
                          ) : roleSearchTerm ? (
                            <div className="role-search-no-results">
                              No roles found matching "{roleSearchTerm}"
                            </div>
                          ) : (
                            <div className="role-search-no-results">
                              Start typing to search for roles...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    className="delete-button"
                    onClick={() => handleRemoveRole(roleIndex)}
                    title="Remove role"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="permissions-grid">
                  {COMMON_CATEGORY_PERMS.map(perm => (
                    <label key={perm} className="permission-checkbox">
                      <input
                        type="checkbox"
                        checked={role.permissions[perm] === true}
                        onChange={(e) => handleRolePermissionChange(roleIndex, perm, e.target.checked)}
                      />
                      <span>{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channels */}
        <div className="template-section-edit">
          <div className="template-section-header">
            <h4>Channels</h4>
            <div className="add-channel-dropdown">
              <button 
                className="add-button" 
                onClick={() => setShowChannelTypeMenu(!showChannelTypeMenu)}
                type="button"
              >
                <Plus size={16} /> Add Channel
              </button>
              {showChannelTypeMenu && (
                <div className="channel-type-menu">
                  <button 
                    className="channel-type-menu-item" 
                    onClick={() => handleAddChannel(0)}
                    type="button"
                  >
                    <Hash size={14} /> Text Channel
                  </button>
                  <button 
                    className="channel-type-menu-item" 
                    onClick={() => handleAddChannel(2)}
                    type="button"
                  >
                    <Volume2 size={14} /> Voice Channel
                  </button>
                  <button 
                    className="channel-type-menu-item" 
                    onClick={() => handleAddChannel(15)}
                    type="button"
                  >
                    <span className="channel-icon-emoji">💬</span> Forum Channel
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="channels-list">
            {editedTemplate.channels.map((channel, index) => (
              <div key={index} className="channel-edit-card">
                <GripVertical className="drag-handle" size={16} />
                <input
                  type="text"
                  className="channel-name-input"
                  value={channel.name}
                  onChange={(e) => handleChannelNameChange(index, e.target.value)}
                  placeholder="channel-name"
                />
                <button
                  className="move-button"
                  onClick={() => handleMoveChannel(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="move-button"
                  onClick={() => handleMoveChannel(index, 'down')}
                  disabled={index === editedTemplate.channels.length - 1}
                  title="Move down"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="delete-button"
                  onClick={() => handleRemoveChannel(index)}
                  title="Remove channel"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
