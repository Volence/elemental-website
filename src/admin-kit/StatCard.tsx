import React from 'react'
import Link from 'next/link'
import type { BadgeTone } from './Badge'

export interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  /** Small line under the value: a delta, a unit, a comparison. */
  hint?: React.ReactNode
  /** Colours the value. Default is neutral text. */
  tone?: Exclude<BadgeTone, 'neutral'> | 'neutral'
  icon?: React.ReactNode
  /** Makes the whole card a link. */
  href?: string
  className?: string
}

/**
 * One stat tile. Replaces the four React StatCard variants and ten SCSS families.
 */
export function StatCard({ label, value, hint, tone = 'neutral', icon, href, className }: StatCardProps) {
  const classes = `kit-stat kit-stat--${tone}${href ? ' kit-stat--link' : ''}${className ? ` ${className}` : ''}`
  const inner = (
    <>
      <div className="kit-stat__label">
        {icon && <span className="kit-stat__icon">{icon}</span>}
        {label}
      </div>
      <div className="kit-stat__value">{value}</div>
      {hint != null && <div className="kit-stat__hint">{hint}</div>}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    )
  }
  return <div className={classes}>{inner}</div>
}

export default StatCard
