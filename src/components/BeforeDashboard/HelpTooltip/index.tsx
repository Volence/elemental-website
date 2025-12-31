'use client'

import React from 'react'

interface HelpTooltipProps {
  content: string | React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Reusable help tooltip component
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({ content, position = 'top' }) => {
  return (
    <span className="help-tooltip">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="help-tooltip__icon"
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
      <div className={`help-tooltip__content help-tooltip__content--${position}`}>
        {typeof content === 'string' ? content : content}
        <div className={`help-tooltip__arrow help-tooltip__arrow--${position}`} />
      </div>
    </span>
  )
}
