'use client'

import React, { useState } from 'react'

interface HelpTooltipProps {
  content: string | React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Reusable help tooltip component
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({ content, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false)

  const positionStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '0.5rem' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.5rem' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '0.5rem' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '0.5rem' },
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: '0.25rem', cursor: 'help' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ verticalAlign: 'middle', opacity: 0.6 }}
      >
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <text
          x="7"
          y="9.5"
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
          fontWeight="bold"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          ?
        </text>
      </svg>
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            ...positionStyles[position],
            backgroundColor: 'var(--theme-elevation-800)',
            color: 'var(--theme-text)',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            lineHeight: '1.4',
            maxWidth: '250px',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            whiteSpace: 'normal',
            pointerEvents: 'none',
          }}
        >
          {typeof content === 'string' ? content : content}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              ...(position === 'top'
                ? { top: '100%', left: '50%', transform: 'translateX(-50%)', borderColor: 'var(--theme-elevation-800) transparent transparent transparent', borderWidth: '6px 6px 0 6px' }
                : position === 'bottom'
                ? { bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderColor: 'transparent transparent var(--theme-elevation-800) transparent', borderWidth: '0 6px 6px 6px' }
                : position === 'left'
                ? { left: '100%', top: '50%', transform: 'translateY(-50%)', borderColor: 'transparent transparent transparent var(--theme-elevation-800)', borderWidth: '6px 0 6px 6px' }
                : { right: '100%', top: '50%', transform: 'translateY(-50%)', borderColor: 'transparent var(--theme-elevation-800) transparent transparent', borderWidth: '6px 6px 6px 0' }),
            }}
          />
        </div>
      )}
    </span>
  )
}
