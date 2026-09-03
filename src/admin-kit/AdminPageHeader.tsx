'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useStepNav } from '@payloadcms/ui'

export interface Breadcrumb {
  label: string
  href?: string
}

export interface AdminPageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  /** Right-aligned actions (buttons, links). */
  actions?: React.ReactNode
  /** Trail ending in the current page. The last item needs no href. */
  breadcrumbs?: Breadcrumb[]
  icon?: React.ReactNode
  /** Override the browser tab title. Defaults to `${title} - Elemental Admin`. */
  documentTitle?: string
}

const TITLE_SUFFIX = ' - Elemental Admin'

/**
 * The one page-title treatment. Also sets the browser tab title (every custom
 * view used to share Payload's generic one) and feeds Payload's step nav so
 * breadcrumbs stay consistent if the global step-nav is ever shown again.
 */
export function AdminPageHeader({ title, subtitle, actions, breadcrumbs, icon, documentTitle }: AdminPageHeaderProps) {
  const { setStepNav } = useStepNav()

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = documentTitle ?? `${title}${TITLE_SUFFIX}`
    }
  }, [title, documentTitle])

  useEffect(() => {
    if (!breadcrumbs || breadcrumbs.length === 0) return
    setStepNav(breadcrumbs.map((crumb) => ({ label: crumb.label, url: crumb.href })))
  }, [breadcrumbs, setStepNav])

  return (
    <header className="kit-page-header">
      {breadcrumbs && breadcrumbs.length > 1 && (
        <nav className="kit-page-header__crumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1
            return (
              <span key={`${crumb.label}-${i}`} className="kit-page-header__crumb">
                {i > 0 && (
                  <span className="kit-page-header__crumb-sep" aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.href && !isLast ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                )}
              </span>
            )
          })}
        </nav>
      )}
      <div className="kit-page-header__row">
        <div className="kit-page-header__titles">
          <h1 className="kit-page-header__title">
            {icon && <span className="kit-page-header__icon">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="kit-page-header__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="kit-page-header__actions">{actions}</div>}
      </div>
    </header>
  )
}

export default AdminPageHeader
