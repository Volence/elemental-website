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
    <div className={`gradient-border-container ${className}`} style={style}>
      <div className="gradient-border-container__content">
        {children}
      </div>
    </div>
  )
}

