'use client'

import React from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

/* ─── Empty ─── */

export interface EmptyStateProps {
  /** "No scrims yet" for onboarding, "No players match" for filtered results. */
  title: React.ReactNode
  hint?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  /** Compact variant for table bodies and small cards. */
  compact?: boolean
  className?: string
}

export function EmptyState({ title, hint, action, icon, compact, className }: EmptyStateProps) {
  return (
    <div className={`kit-empty${compact ? ' kit-empty--compact' : ''}${className ? ` ${className}` : ''}`}>
      <div className="kit-empty__icon" aria-hidden="true">
        {icon ?? <Inbox size={compact ? 18 : 28} />}
      </div>
      <div className="kit-empty__title">{title}</div>
      {hint && <div className="kit-empty__hint">{hint}</div>}
      {action && <div className="kit-empty__action">{action}</div>}
    </div>
  )
}

/* ─── Loading ─── */

export interface LoadingStateProps {
  /** Number of skeleton lines. 0 renders a spinner with the label instead. */
  rows?: number
  label?: string
  className?: string
}

export function LoadingState({ rows = 4, label = 'Loading', className }: LoadingStateProps) {
  if (rows <= 0) {
    return (
      <div className={`kit-loading kit-loading--spinner${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
        <Loader2 size={16} className="kit-spin" aria-hidden="true" />
        <span>{label}</span>
      </div>
    )
  }
  return (
    <div className={`kit-loading${className ? ` ${className}` : ''}`} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="kit-skeleton" style={{ width: `${100 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  )
}

/* ─── Error ─── */

export interface ErrorStateProps {
  message: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({ message, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <div className={`kit-error${className ? ` ${className}` : ''}`} role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div className="kit-error__message">{message}</div>
      {onRetry && (
        <button type="button" className="kit-btn" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}
