import React from 'react'
import { cn } from '@/utilities/ui'

/**
 * Public page primitives. Every top-level page renders the same shell so widths,
 * vertical rhythm and heading sizes agree; the PUG pages adopt them first.
 */

export interface PageShellProps {
  children: React.ReactNode
  /** Tailwind max-width class for narrow forms, e.g. "max-w-md". */
  width?: string
  className?: string
}

export function PageShell({ children, width, className }: PageShellProps) {
  return <main className={cn('container mx-auto px-4 pb-8', width, className)}>{children}</main>
}

export interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-aligned actions or status. */
  aside?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, aside, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        <h1 className="text-3xl font-bold mb-1">{title}</h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </header>
  )
}

export interface SectionProps {
  title?: React.ReactNode
  description?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** A card-styled section: the one box style for public content blocks. */
export function Section({ title, description, aside, children, className }: SectionProps) {
  return (
    <section className={cn('border border-border rounded-xl bg-card/60 overflow-hidden', className)}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            {title && <h2 className="text-lg font-bold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {aside}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
