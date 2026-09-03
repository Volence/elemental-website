import React from 'react'

export interface SectionCardProps {
  title?: React.ReactNode
  /** Right-aligned controls in the card header. */
  actions?: React.ReactNode
  description?: React.ReactNode
  /** Remove body padding for tables and lists that fill the card. */
  flush?: boolean
  children: React.ReactNode
  className?: string
  id?: string
}

/**
 * The generic panel: Clean Glow border, elevation, optional header row.
 * Replaces .ps-card, .profile-card, .ar-stat, .scrim-card and friends.
 */
export function SectionCard({ title, actions, description, flush, children, className, id }: SectionCardProps) {
  const hasHeader = title != null || actions != null || description != null
  return (
    <section id={id} className={`kit-card${flush ? ' kit-card--flush' : ''}${className ? ` ${className}` : ''}`}>
      {hasHeader && (
        <div className="kit-card__header">
          <div className="kit-card__heading">
            {title != null && <h3 className="kit-card__title">{title}</h3>}
            {description != null && <p className="kit-card__description">{description}</p>}
          </div>
          {actions && <div className="kit-card__actions">{actions}</div>}
        </div>
      )}
      <div className="kit-card__body">{children}</div>
    </section>
  )
}

export default SectionCard
