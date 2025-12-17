'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface EmptyStateProps {
  emoji?: string
  title: string
  description: string
  actionText?: string
  actionHref?: string
}

/**
 * Generic empty state component for collections
 */
const EmptyState: React.FC<EmptyStateProps> = ({ 
  emoji = '📦',
  title,
  description,
  actionText,
  actionHref
}) => {
  const router = useRouter()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
        minHeight: '400px',
      }}
    >
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>
        {emoji}
      </div>
      <h3 style={{ 
        fontSize: '1.5rem',
        fontWeight: 600,
        color: 'var(--theme-text)',
        marginBottom: '0.75rem',
      }}>
        {title}
      </h3>
      <p style={{ 
        fontSize: '1rem',
        color: 'var(--theme-text-600)',
        maxWidth: '500px',
        marginBottom: '2rem',
        lineHeight: '1.6',
      }}>
        {description}
      </p>
      {actionText && actionHref && (
        <button
          onClick={() => router.push(actionHref)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--theme-success-500)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-success-600)'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-success-500)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  )
}

export default EmptyState
