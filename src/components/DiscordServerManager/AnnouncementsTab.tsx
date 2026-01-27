'use client'

import React, { useState, useEffect } from 'react'
import { Send, Eye, Palette, Image, MessageSquare, Hash, Volume2, Bell, Plus, Trash2 } from 'lucide-react'

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
}

interface EmbedField {
  id: string
  name: string
  value: string
  inline: boolean
}

interface EmbedConfig {
  enabled: boolean
  title: string
  description: string
  color: string
  footer: string
  fields: EmbedField[]
}

interface AnnouncementsTabProps {
  structure: ServerStructure | null
  onSuccess: (title: string, message: string) => void
  onError: (title: string, message: string) => void
}

// Discord-like markdown preview (basic)
const formatDiscordMarkdown = (text: string): string => {
  // First, handle code blocks (``` ... ```) - must be done before other replacements
  // The regex captures content between ```, stripping optional language tag and surrounding newlines
  let result = text.replace(/```(?:\w*)\n?([\s\S]*?)\n?```/g, (match, code) => {
    // Aggressively trim ALL leading and trailing whitespace/newlines
    const trimmed = code.trim()
    
    // Skip if empty
    if (!trimmed) {
      return ''
    }
    
    // Preserve the code content, escape HTML, and wrap in pre/code
    const escaped = trimmed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<pre class="discord-codeblock"><code>${escaped}</code></pre>`
  })
  
  // Then handle inline code (single backticks) - but not if already processed
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Handle other markdown
  result = result
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
  
  // Handle newlines (but not inside pre blocks - already preserved)
  // Split by pre blocks, process newlines only outside them
  const parts = result.split(/(<pre class="discord-codeblock">[\s\S]*?<\/pre>)/)
  result = parts.map(part => {
    if (part.startsWith('<pre class="discord-codeblock">')) {
      return part // Keep code blocks as-is
    }
    return part.replace(/\n/g, '<br/>')
  }).join('')
  
  return result
}

// Channel type icons
const getChannelIcon = (type: number) => {
  switch (type) {
    case 0: return <Hash className="w-4 h-4" /> // Text
    case 2: return <Volume2 className="w-4 h-4" /> // Voice
    case 5: return <Bell className="w-4 h-4" /> // Announcement
    default: return <Hash className="w-4 h-4" />
  }
}

// Filter to text-based channels only
const isTextChannel = (type: number) => [0, 5, 10, 11, 12].includes(type)

export default function AnnouncementsTab({ structure, onSuccess, onError }: AnnouncementsTabProps) {
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [content, setContent] = useState('')
  const [embed, setEmbed] = useState<EmbedConfig>({
    enabled: false,
    title: '',
    description: '',
    color: '#00D4AA',
    footer: '',
    fields: [],
  })
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  // Field management helpers
  const addField = () => {
    setEmbed(prev => ({
      ...prev,
      fields: [...prev.fields, {
        id: `field-${Date.now()}`,
        name: '',
        value: '',
        inline: true,
      }]
    }))
  }

  const updateField = (id: string, updates: Partial<EmbedField>) => {
    setEmbed(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f)
    }))
  }

  const removeField = (id: string) => {
    setEmbed(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id)
    }))
  }

  // Get all text channels grouped by category
  const getGroupedChannels = () => {
    if (!structure) return []
    
    const groups: { category: string; channels: DiscordChannel[] }[] = []
    
    // Add categorized channels
    for (const category of structure.categories) {
      const textChannels = category.channels.filter(ch => isTextChannel(ch.type))
      if (textChannels.length > 0) {
        groups.push({
          category: category.name,
          channels: textChannels.sort((a, b) => a.position - b.position)
        })
      }
    }
    
    // Add uncategorized channels
    const uncategorizedText = structure.uncategorized.filter(ch => isTextChannel(ch.type))
    if (uncategorizedText.length > 0) {
      groups.push({
        category: 'Uncategorized',
        channels: uncategorizedText.sort((a, b) => a.position - b.position)
      })
    }
    
    return groups
  }

  const handleSend = async () => {
    if (!selectedChannelId) {
      onError('Validation Error', 'Please select a channel')
      return
    }
    
    if (!content.trim() && !embed.enabled) {
      onError('Validation Error', 'Please enter a message or enable embed')
      return
    }

    if (embed.enabled && !embed.title.trim() && !embed.description.trim()) {
      onError('Validation Error', 'Embed must have a title or description')
      return
    }

    try {
      setSending(true)
      
      const requestBody: any = {
        channelId: selectedChannelId,
      }
      
      if (content.trim()) {
        requestBody.content = content.trim()
      }
      
      if (embed.enabled) {
        // Filter out empty fields
        const validFields = embed.fields.filter(f => f.name.trim() || f.value.trim())
        
        requestBody.embed = {
          title: embed.title.trim() || undefined,
          description: embed.description.trim() || undefined,
          color: embed.color,
          footer: embed.footer.trim() || undefined,
          fields: validFields.length > 0 ? validFields.map(f => ({
            name: f.name.trim(),
            value: f.value.trim(),
            inline: f.inline,
          })) : undefined,
        }
      }
      
      const response = await fetch('/api/discord/server/post-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }
      
      const result = await response.json()
      
      // Clear form
      setContent('')
      setEmbed({
        enabled: false,
        title: '',
        description: '',
        color: '#00D4AA',
        footer: '',
        fields: [],
      })
      
      onSuccess('Message Sent!', `Successfully posted to #${result.channelName}`)
      
    } catch (err: any) {
      onError('Error', err.message)
    } finally {
      setSending(false)
    }
  }

  const selectedChannel = (() => {
    if (!structure || !selectedChannelId) return null
    for (const cat of structure.categories) {
      const ch = cat.channels.find(c => c.id === selectedChannelId)
      if (ch) return { channel: ch, category: cat.name }
    }
    const unch = structure.uncategorized.find(c => c.id === selectedChannelId)
    if (unch) return { channel: unch, category: 'Uncategorized' }
    return null
  })()

  const groupedChannels = getGroupedChannels()

  return (
    <div className="announcements-tab">
      <div className="announcements-tab__header">
        <h3>📢 Post Announcement</h3>
        <p>Send a message to any text channel in the Discord server</p>
      </div>

      <div className="announcements-tab__content">
        {/* Left side: Composer */}
        <div className="announcements-tab__composer">
          {/* Channel Selector */}
          <div className="announcements-tab__field">
            <label>Target Channel</label>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="announcements-tab__select"
            >
              <option value="">Select a channel...</option>
              {groupedChannels.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Message Content */}
          <div className="announcements-tab__field">
            <label>
              <MessageSquare className="w-4 h-4" />
              Message Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message here... Supports **bold**, *italic*, __underline__, ~~strikethrough~~"
              className="announcements-tab__textarea"
              rows={5}
            />
          </div>

          {/* Embed Toggle */}
          <div className="announcements-tab__embed-toggle">
            <label className="announcements-tab__checkbox-label">
              <input
                type="checkbox"
                checked={embed.enabled}
                onChange={(e) => setEmbed({ ...embed, enabled: e.target.checked })}
              />
              <span>Add Rich Embed</span>
            </label>
          </div>

          {/* Embed Options */}
          {embed.enabled && (
            <div className="announcements-tab__embed-options">
              <div className="announcements-tab__field">
                <label>Embed Title</label>
                <input
                  type="text"
                  value={embed.title}
                  onChange={(e) => setEmbed({ ...embed, title: e.target.value })}
                  placeholder="Announcement Title"
                  className="announcements-tab__input"
                />
              </div>
              
              <div className="announcements-tab__field">
                <label>Embed Description</label>
                <textarea
                  value={embed.description}
                  onChange={(e) => setEmbed({ ...embed, description: e.target.value })}
                  placeholder="Detailed description..."
                  className="announcements-tab__textarea"
                  rows={4}
                />
              </div>
              
              <div className="announcements-tab__field-row">
                <div className="announcements-tab__field">
                  <label>
                    <Palette className="w-4 h-4" />
                    Embed Color
                  </label>
                  <div className="announcements-tab__color-picker">
                    <input
                      type="color"
                      value={embed.color}
                      onChange={(e) => setEmbed({ ...embed, color: e.target.value })}
                      className="announcements-tab__color-input"
                    />
                    <input
                      type="text"
                      value={embed.color}
                      onChange={(e) => setEmbed({ ...embed, color: e.target.value })}
                      className="announcements-tab__input announcements-tab__input--small"
                      placeholder="#00D4AA"
                    />
                  </div>
                </div>
                
                <div className="announcements-tab__field">
                  <label>Footer Text</label>
                  <input
                    type="text"
                    value={embed.footer}
                    onChange={(e) => setEmbed({ ...embed, footer: e.target.value })}
                    placeholder="Optional footer"
                    className="announcements-tab__input"
                  />
                </div>
              </div>

              {/* Embed Fields */}
              <div className="announcements-tab__fields-section">
                <div className="announcements-tab__fields-header">
                  <label>Embed Fields</label>
                  <button
                    type="button"
                    onClick={addField}
                    className="announcements-tab__add-field-btn"
                    disabled={embed.fields.length >= 25}
                  >
                    <Plus className="w-3 h-3" />
                    Add Field
                  </button>
                </div>
                
                {embed.fields.length > 0 && (
                  <div className="announcements-tab__fields-list">
                    {embed.fields.map((field, index) => (
                      <div key={field.id} className="announcements-tab__field-item">
                        <div className="announcements-tab__field-item-header">
                          <span className="announcements-tab__field-item-number">Field {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeField(field.id)}
                            className="announcements-tab__field-delete-btn"
                            title="Remove field"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <div className="announcements-tab__field-item-inputs">
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateField(field.id, { name: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                            placeholder="Field name (header)"
                            className="announcements-tab__input"
                          />
                          <textarea
                            value={field.value}
                            onChange={(e) => updateField(field.id, { value: e.target.value })}
                            placeholder="Field value (put each row on a new line)"
                            className="announcements-tab__textarea announcements-tab__textarea--small"
                            rows={3}
                          />
                          <label className="announcements-tab__inline-toggle">
                            <input
                              type="checkbox"
                              checked={field.inline}
                              onChange={(e) => updateField(field.id, { inline: e.target.checked })}
                            />
                            <span>Inline (display side-by-side)</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {embed.fields.length === 0 && (
                  <p className="announcements-tab__fields-hint">
                    Add fields to create table-like layouts. Set fields as "inline" to display them in columns.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Send Button */}
          <div className="announcements-tab__actions">
            <button
              onClick={handleSend}
              disabled={sending || !selectedChannelId}
              className="announcements-tab__send-btn"
            >
              {sending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right side: Preview */}
        <div className="announcements-tab__preview">
          <div className="announcements-tab__preview-header">
            <Eye className="w-4 h-4" />
            <span>Preview</span>
            {selectedChannel && (
              <span className="announcements-tab__preview-channel">
                #{selectedChannel.channel.name}
              </span>
            )}
          </div>
          
          <div className="announcements-tab__preview-content">
            {!content.trim() && !embed.enabled ? (
              <div className="announcements-tab__preview-empty">
                Start typing to see preview...
              </div>
            ) : (
              <div className="announcements-tab__discord-message">
                {/* Bot avatar/name */}
                <div className="announcements-tab__message-header">
                  <div className="announcements-tab__bot-avatar">🤖</div>
                  <span className="announcements-tab__bot-name">ELMT Bot</span>
                  <span className="announcements-tab__message-time">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                {/* Message content */}
                {content.trim() && (
                  <div 
                    className="announcements-tab__message-content"
                    dangerouslySetInnerHTML={{ __html: formatDiscordMarkdown(content) }}
                  />
                )}
                
                {/* Embed preview */}
                {embed.enabled && (embed.title || embed.description || embed.fields.length > 0) && (
                  <div 
                    className="announcements-tab__embed-preview"
                    style={{ borderLeftColor: embed.color }}
                  >
                    {embed.title && (
                      <div className="announcements-tab__embed-title">{embed.title}</div>
                    )}
                    {embed.description && (
                      <div 
                        className="announcements-tab__embed-description"
                        dangerouslySetInnerHTML={{ __html: formatDiscordMarkdown(embed.description) }}
                      />
                    )}
                    {/* Embed fields preview */}
                    {embed.fields.length > 0 && (
                      <div className="announcements-tab__embed-fields">
                        {embed.fields.map(field => (
                          <div 
                            key={field.id} 
                            className={`announcements-tab__embed-field ${field.inline ? 'announcements-tab__embed-field--inline' : ''}`}
                          >
                            {field.name && (
                              <div className="announcements-tab__embed-field-name">{field.name}</div>
                            )}
                            {field.value && (
                              <div 
                                className="announcements-tab__embed-field-value"
                                dangerouslySetInnerHTML={{ __html: formatDiscordMarkdown(field.value) }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {embed.footer && (
                      <div className="announcements-tab__embed-footer">{embed.footer}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
