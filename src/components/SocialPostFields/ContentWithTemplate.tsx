'use client'

import React, { useEffect } from 'react'
import { TextareaField, useField, useForm } from '@payloadcms/ui'

export default function ContentWithTemplate(props: any) {
  const { value, setValue } = useField({ path: 'content' })
  const formContext = useForm()
  
  useEffect(() => {
    // Only run on initial load
    if (value) return // Don't override if there's already a value
    
    // Check if there's template data in localStorage
    const templateDataStr = localStorage.getItem('socialPostTemplate')
    
    if (templateDataStr) {
      try {
        const templateData = JSON.parse(templateDataStr)
        
        // Only use if it's recent (within last 5 minutes)
        if (Date.now() - templateData.timestamp < 5 * 60 * 1000) {
          // Small delay to let form initialize
          setTimeout(() => {
            // Pre-fill the content field
            if (templateData.content) {
              setValue(templateData.content)
            }
            
            // Pre-fill the title field
            if (templateData.title && formContext.dispatchFields) {
              formContext.dispatchFields({
                type: 'UPDATE',
                path: 'title',
                value: templateData.title,
              })
            }
            
            // Pre-fill the postType field
            if (templateData.postType && formContext.dispatchFields) {
              formContext.dispatchFields({
                type: 'UPDATE',
                path: 'postType',
                value: templateData.postType,
              })
            }
            
            // Clear the localStorage after using
            localStorage.removeItem('socialPostTemplate')
            
            // Show a notification to the user
            const notification = document.createElement('div')
            notification.textContent = '✨ Template applied! Your post has been pre-filled.'
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              color: white;
              padding: 1rem 1.5rem;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
              z-index: 10000;
              font-weight: 600;
            `
            document.body.appendChild(notification)
            
            setTimeout(() => {
              notification.remove()
            }, 3000)
          }, 100)
        } else {
          // Clean up old template data
          localStorage.removeItem('socialPostTemplate')
        }
      } catch (error) {
        console.error('Error loading template data:', error)
        localStorage.removeItem('socialPostTemplate')
      }
    }
  }, []) // Empty deps - only run once on mount
  
  // Render the default textarea field
  return <TextareaField {...props} />
}

