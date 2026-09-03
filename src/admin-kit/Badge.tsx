import React from 'react'

/**
 * Semantic tones only. Feature code maps its enum to a tone through a TONES
 * map and never passes a colour. Green (success) is reserved for terminal
 * success states: complete, win, healthy.
 */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

export interface BadgeProps {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  /** Leading status dot. */
  dot?: boolean
  /** Uppercase small-caps treatment for short codes (NA, EMEA, W, L). */
  uppercase?: boolean
  title?: string
  children: React.ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', size = 'md', dot, uppercase, title, children, className }: BadgeProps) {
  const classes = ['kit-badge', `kit-badge--${tone}`, `kit-badge--${size}`]
  if (uppercase) classes.push('kit-badge--upper')
  if (className) classes.push(className)
  return (
    <span className={classes.join(' ')} title={title}>
      {dot && <span className="kit-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

export default Badge
