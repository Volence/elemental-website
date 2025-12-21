'use client'

import React from 'react'

interface GradientBorderProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

/**
 * Reusable gradient border container component
 * Creates a cyan-to-lime gradient border around content
 */
export const GradientBorder: React.FC<GradientBorderProps> = ({ children, className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        padding: '2px', // Border width
        marginBottom: '1.5rem',
        borderRadius: '8px',
        background: 'linear-gradient(to right, #00FFFF, #BFFF00)',
        ...style,
      }}
    >
      <div
        style={{
          padding: '1.25rem',
          borderRadius: '6px',
          backgroundColor: 'transparent',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}

