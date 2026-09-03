'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import type { Person } from '@/payload-types'
import { ConfirmDialogProvider } from '@/components/ConfirmDialog'
import ChunkReloadGuard from '@/components/ChunkReloadGuard'

/**
 * AdminProviders - Wraps all admin pages and provides shared functionality
 * 
 * Currently provides:
 * - Doc-controls popup position fix (Payload sets wrong position via JS)
 * - Global interception of raw collection links -> custom card editors (teams, people, staff, events, invites)
 */
export default function AdminProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth<Person>()
  const lastReportedPath = useRef<string | null>(null)

  // Usage telemetry: one beacon per admin navigation (see /api/admin-telemetry/page-view).
  // keepalive lets the request finish even if the user navigates away immediately.
  useEffect(() => {
    if (!user?.id || !pathname || !pathname.startsWith('/admin')) return
    if (lastReportedPath.current === pathname) return
    lastReportedPath.current = pathname
    fetch('/api/admin-telemetry/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      credentials: 'include',
      keepalive: true,
    }).catch(() => {
      // Telemetry must never surface as an admin error.
    })
  }, [pathname, user?.id])
  
  // Global: intercept navigation to custom admin views.
  // Safety net for any Payload-rendered link that still points at the raw
  // collection edit forms - primary links are rewritten at the source.
  useEffect(() => {
    if (!user?.id) return

    const detailRoutes: Array<{ pattern: RegExp; to: (id: string) => string }> = [
      { pattern: /\/admin\/collections\/invite-links\/(\d+)(?:$|[?#])/, to: (id) => `/admin/edit-invite?id=${id}` },
      { pattern: /\/admin\/collections\/people\/(\d+)(?:$|[?#])/, to: (id) => `/admin/edit-person?id=${id}` },
      { pattern: /\/admin\/collections\/teams\/(\d+)(?:$|[?#])/, to: (id) => `/admin/edit-team?id=${id}` },
      { pattern: /\/admin\/collections\/organization-staff\/(\d+)(?:$|[?#])/, to: (id) => `/admin/edit-staff?type=org&id=${id}` },
      { pattern: /\/admin\/collections\/production\/(\d+)(?:$|[?#])/, to: (id) => `/admin/edit-staff?type=production&id=${id}` },
      { pattern: /\/admin\/collections\/global-calendar-events\/(\d+)(?:$|[?#])/, to: (id) => `/admin/edit-event?id=${id}` },
    ]

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a') as HTMLAnchorElement | null
      if (!link) return

      // Respect new-tab/window intent - never hijack modified clicks.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      if (link.target === '_blank') return

      const href = link.getAttribute('href') ?? ''

      // Account avatar -> custom person editor
      if (href === '/admin/account') {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-person?id=${user.id}`
        return
      }

      // Invite Links: create -> custom editor
      if (href === '/admin/collections/invite-links/create') {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = '/admin/edit-invite'
        return
      }

      for (const route of detailRoutes) {
        const match = href.match(route.pattern)
        if (match) {
          e.preventDefault()
          e.stopPropagation()
          window.location.href = route.to(match[1])
          return
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [user?.id])

  // Note: Popup positioning is handled by Payload's built-in JS.
  // Do NOT override popup positions - Payload calculates them from trigger button coordinates.
  
  return (
    <ConfirmDialogProvider>
      <ChunkReloadGuard />
      {children}
    </ConfirmDialogProvider>
  )
}
