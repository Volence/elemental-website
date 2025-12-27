'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { TemplateModal } from './TemplateModal'

interface PostTemplate {
  name: string
  postType: string
  templateText: string
  suggestedMedia?: string
}

export function TemplatesView() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<PostTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<PostTemplate | null>(null)
  const [modalTemplate, setModalTemplate] = useState<PostTemplate | null>(null)

  const isManager = user?.role === 'admin' || user?.role === 'staff-manager'

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/globals/social-media-config?depth=0')
      const data = await response.json()
      
      setTemplates(data.postTemplates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const getPostTypeBadgeColor = (postType: string) => {
    const colors: Record<string, string> = {
      'Match Promo': '#3b82f6',
      'Stream Announcement': '#8b5cf6',
      'Community Engagement': '#10b981',
      'Original Content': '#f59e0b',
      'Repost/Share': '#6b7280',
      'Other': '#64748b',
    }
    return colors[postType] || '#64748b'
  }


  if (loading) {
    return <div className="loading-spinner">Loading templates...</div>
  }

  return (
    <div className="templates-view">
      <div className="templates-view__header">
        <h2>Post Templates</h2>
        <p>Reusable templates for common post types</p>
      </div>

      <div className="templates-view__instructions">
        <h3>📄 How to Use Templates</h3>
        <ol>
          <li><strong>Click "Use Template"</strong> on any template below</li>
          <li><strong>Fill in the placeholders</strong> - The modal auto-detects ALL placeholders (<code>{'{{team_1}}'}</code>, <code>{'{{url}}'}</code>, etc.)</li>
          <li><strong>Preview in real-time</strong> - See your post update as you type</li>
          <li><strong>Click "Create Post"</strong> - Opens a new post with everything pre-filled!</li>
          <li><strong>Add media and schedule</strong> - Upload images/videos and set your post time</li>
        </ol>
        <p style={{ marginTop: '1rem', color: 'var(--theme-elevation-500)', fontSize: '0.9rem' }}>
          💡 <strong>Tip:</strong> Templates support ANY <code style={{ 
            padding: '2px 4px', 
            background: 'rgba(59, 130, 246, 0.15)', 
            borderRadius: '3px', 
            fontSize: '0.85em'
          }}>{'{{placeholder}}'}</code> format - they're automatically detected! You can also click "Copy to Clipboard" in the modal if you just need the text.
        </p>
        {isManager && (
          <div className="templates-view__manage">
            <Link 
              href="/admin/globals/social-media-config"
              className="btn btn--secondary"
            >
              ⚙️ Manage Templates
            </Link>
          </div>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📝</div>
          <h3 className="empty-state__title">No Templates Yet</h3>
          <p className="empty-state__description">
            {isManager 
              ? 'Create your first template to help your team post consistently and save time.'
              : 'Templates will appear here once your manager creates them. Templates help you create posts faster with pre-written text and placeholders.'}
          </p>
          {isManager && (
            <Link href="/admin/globals/social-media-config" className="btn">
              + Create Your First Template
            </Link>
          )}
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map((template, index) => (
            <div 
              key={index} 
              className="template-card"
              onClick={() => setSelectedTemplate(selectedTemplate?.name === template.name ? null : template)}
            >
              <div className="template-card__header">
                <h3>{template.name}</h3>
                <span 
                  className="post-type-badge"
                  style={{ 
                    backgroundColor: `${getPostTypeBadgeColor(template.postType)}20`,
                    color: getPostTypeBadgeColor(template.postType),
                    border: `1px solid ${getPostTypeBadgeColor(template.postType)}40`
                  }}
                >
                  {template.postType}
                </span>
              </div>

              <div className="template-card__content">
                <div className="template-text">
                  {template.templateText}
                </div>
                {template.suggestedMedia && (
                  <div className="template-media-suggestion">
                    <strong>💡 Suggested Media:</strong> {template.suggestedMedia}
                  </div>
                )}
                {(() => {
                  // Extract placeholders from this template
                  try {
                    const regex = /\{\{(\w+)\}\}/g
                    const placeholders = new Set<string>()
                    let match
                    while ((match = regex.exec(template.templateText)) !== null) {
                      placeholders.add(match[1])
                    }
                    const placeholderArray = Array.from(placeholders)
                    
                    if (placeholderArray.length > 0) {
                      return (
                        <div className="template-card__placeholders">
                          <h4>📝 Fields to fill ({placeholderArray.length}):</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {placeholderArray.map((placeholder) => (
                              <code key={placeholder} style={{ 
                                fontSize: '0.8rem',
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '4px',
                                color: '#3b82f6'
                              }}>
                                {placeholder}
                              </code>
                            ))}
                          </div>
                        </div>
                      )
                    }
                  } catch (error) {
                    console.error('Error extracting placeholders:', error)
                  }
                  return null
                })()}
              </div>

              <div className="template-card__actions">
                <button
                  className="btn btn--primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    setModalTemplate(template)
                  }}
                >
                  ✨ Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Modal */}
      {modalTemplate && (
        <TemplateModal
          template={modalTemplate}
          onClose={() => setModalTemplate(null)}
        />
      )}
    </div>
  )
}

