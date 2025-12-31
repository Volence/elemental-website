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
      >
        {/* Modal */}
        <div
          className="template-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="template-modal__header">
            <div>
              <h2>
                📝 Use Template: {template.name}
              </h2>
              <p>
                Fill in the placeholders below to customize your post
              </p>
            </div>
            <button
              onClick={onClose}
              className="template-modal__close-btn"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="template-modal__body">
            {/* Post Title */}
            <div className="template-modal__field">
              <label>
                Post Title (Internal)
              </label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="e.g., Week 3 Match - ELMT Fire vs Team Evil water"
              />
              <p className="template-modal__field-hint">
                This helps you identify the post later (not shown to followers)
              </p>
            </div>

            {/* Placeholder Inputs */}
            {placeholders.length > 0 && (
              <div className="template-modal__section">
                <h3>
                  Fill in Details
                </h3>
                <div className="template-modal__fields-grid">
                  {placeholders.map((placeholder) => (
                    <div key={placeholder} className="template-modal__field">
                      <label>
                        {placeholder}
                      </label>
                      <input
                        type="text"
                        value={placeholderValues[placeholder] || ''}
                        onChange={(e) => handlePlaceholderChange(placeholder, e.target.value)}
                        placeholder={`Enter ${placeholder}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="template-modal__section">
              <h3>
                Preview
              </h3>
              <div className="template-modal__preview">
                {filledContent}
              </div>
            </div>

            {template.suggestedMedia && (
              <div className="template-modal__media-suggestion">
                <strong>💡 Suggested Media:</strong>{' '}
                <span>
                  {template.suggestedMedia}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="template-modal__footer">
            <button
              onClick={handleCopyToClipboard}
              className="template-modal__btn template-modal__btn--secondary"
            >
              📋 Copy to Clipboard
            </button>
            <button
              onClick={handleUseTemplate}
              className="template-modal__btn template-modal__btn--primary"
            >
              ✨ Create Post
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

