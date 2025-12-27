'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TemplateModalProps {
  template: {
    name: string
    postType: string
    templateText: string
    suggestedMedia?: string
  }
  onClose: () => void
}

export function TemplateModal({ template, onClose }: TemplateModalProps) {
  const router = useRouter()
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({})
  const [filledContent, setFilledContent] = useState('')
  const [postTitle, setPostTitle] = useState('')

  // Extract placeholders from template text
  const extractPlaceholders = (text: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g
    const matches = text.matchAll(regex)
    const placeholders = new Set<string>()
    for (const match of matches) {
      placeholders.add(match[1])
    }
    return Array.from(placeholders)
  }

  const placeholders = extractPlaceholders(template.templateText)

  // Update filled content when placeholder values change
  useEffect(() => {
    let content = template.templateText
    Object.entries(placeholderValues).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      content = content.replace(regex, value || `{{${key}}}`)
    })
    setFilledContent(content)
  }, [placeholderValues, template.templateText])

  const handlePlaceholderChange = (placeholder: string, value: string) => {
    setPlaceholderValues(prev => ({
      ...prev,
      [placeholder]: value,
    }))
  }

  const handleUseTemplate = () => {
    // Store the filled template in localStorage to pre-fill the create form
    const templateData = {
      title: postTitle,
      content: filledContent,
      postType: template.postType,
      suggestedMedia: template.suggestedMedia,
      timestamp: Date.now(),
    }
    localStorage.setItem('socialPostTemplate', JSON.stringify(templateData))
    
    // Navigate to create post page
    router.push('/admin/collections/social-posts/create')
  }

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(filledContent)
    // Could add a toast notification here
    alert('Template copied to clipboard!')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="template-modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        {/* Modal */}
        <div
          className="template-modal"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--theme-elevation-0)',
            borderRadius: '12px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid var(--theme-elevation-200)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color: 'var(--theme-text)',
                  fontSize: '1.3rem',
                  fontWeight: 600,
                }}
              >
                📝 Use Template: {template.name}
              </h2>
              <p
                style={{
                  margin: '0.5rem 0 0 0',
                  color: 'var(--theme-elevation-500)',
                  fontSize: '0.9rem',
                }}
              >
                Fill in the placeholders below to customize your post
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--theme-elevation-500)',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.5rem',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '2rem' }}>
            {/* Post Title */}
            <div style={{ marginBottom: '2rem' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: 'var(--theme-text)',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                Post Title (Internal)
              </label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="e.g., Week 3 Match - ELMT Fire vs Team Evil water"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--theme-elevation-100)',
                  border: '1px solid var(--theme-elevation-300)',
                  borderRadius: '6px',
                  color: 'var(--theme-text)',
                  fontSize: '0.95rem',
                }}
              />
              <p
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--theme-elevation-500)',
                }}
              >
                This helps you identify the post later (not shown to followers)
              </p>
            </div>

            {/* Placeholder Inputs */}
            {placeholders.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3
                  style={{
                    margin: '0 0 1rem 0',
                    color: 'var(--theme-text)',
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                >
                  Fill in Details
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {placeholders.map((placeholder) => (
                    <div key={placeholder}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          color: 'var(--theme-text)',
                          fontSize: '0.9rem',
                          fontWeight: 500,
                        }}
                      >
                        {placeholder}
                      </label>
                      <input
                        type="text"
                        value={placeholderValues[placeholder] || ''}
                        onChange={(e) => handlePlaceholderChange(placeholder, e.target.value)}
                        placeholder={`Enter ${placeholder}`}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'var(--theme-elevation-100)',
                          border: '1px solid var(--theme-elevation-300)',
                          borderRadius: '6px',
                          color: 'var(--theme-text)',
                          fontSize: '0.95rem',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div>
              <h3
                style={{
                  margin: '0 0 1rem 0',
                  color: 'var(--theme-text)',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                Preview
              </h3>
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--theme-elevation-100)',
                  border: '1px solid var(--theme-elevation-300)',
                  borderRadius: '8px',
                  color: 'var(--theme-elevation-600)',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  minHeight: '100px',
                }}
              >
                {filledContent}
              </div>
            </div>

            {template.suggestedMedia && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                }}
              >
                <strong style={{ color: 'var(--theme-text)' }}>💡 Suggested Media:</strong>{' '}
                <span style={{ color: 'var(--theme-elevation-600)' }}>
                  {template.suggestedMedia}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1.5rem 2rem',
              borderTop: '1px solid var(--theme-elevation-200)',
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={handleCopyToClipboard}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--theme-elevation-100)',
                border: '1px solid var(--theme-elevation-300)',
                borderRadius: '6px',
                color: 'var(--theme-text)',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              📋 Copy to Clipboard
            </button>
            <button
              onClick={handleUseTemplate}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(59, 130, 246, 0.4)',
              }}
            >
              ✨ Create Post
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

