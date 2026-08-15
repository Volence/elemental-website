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
 * - Sidebar scroll position preservation across navigation
 * - Doc-controls popup position fix (Payload sets wrong position via JS)
 * - Global interception of raw collection links -> custom card editors (teams, people, staff, events, invites)
 */
export default function AdminProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFirstRender = useRef(true)
  const { user } = useAuth<Person>()
  
  // Sidebar scroll preservation
  useEffect(() => {
    const aside = document.querySelector('aside')
    if (!aside) return
    
    const storageKey = 'elemental-sidebar-scroll'
    
    // On first render, restore the saved scroll position
    if (isFirstRender.current) {
      isFirstRender.current = false
      const savedPosition = sessionStorage.getItem(storageKey)
      if (savedPosition) {
        // Use setTimeout to ensure the sidebar is fully rendered
        setTimeout(() => {
          aside.scrollTop = parseInt(savedPosition, 10)
        }, 50)
      }
    }
    
    // Save scroll position when it changes
    const handleScroll = () => {
      sessionStorage.setItem(storageKey, aside.scrollTop.toString())
    }
    
    aside.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      aside.removeEventListener('scroll', handleScroll)
    }
  }, [pathname])

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

  // Global: highlight sidebar nav item for custom edit views
  useEffect(() => {
    const routeToCollection: Record<string, string> = {
      '/admin/edit-event': '/collections/global-calendar-events',
      '/admin/edit-invite': '/collections/invite-links',
      '/admin/edit-person': '/collections/people',
      '/admin/my-profile': '/collections/people',
      '/admin/pug-dashboard': '/collections/pug-seasons',
      '/admin/edit-pug-season': '/collections/pug-seasons',
      '/admin/edit-pug-player': '/collections/people',
      '/admin/edit-pug-match': '/collections/pug-matches',
      '/admin/edit-pug-leaderboard': '/collections/pug-leaderboard',
      '/admin/edit-team': '/collections/teams',
      '/admin/edit-staff': '/collections/organization-staff',
      '/admin/staff-directory': '/collections/organization-staff',
    }
    const target = routeToCollection[pathname]
    if (!target) return

    // Highlight the matching sidebar nav link
    setTimeout(() => {
      const links = document.querySelectorAll('aside nav a')
      links.forEach(link => {
        const href = link.getAttribute('href') ?? ''
        if (href.includes(target)) {
          ;(link as HTMLElement).style.opacity = '1'
          ;(link as HTMLElement).style.color = '#34d399'
        }
      })
    }, 100)
  }, [pathname])
  
  // Note: Popup positioning is handled by Payload's built-in JS.
  // Do NOT override popup positions - Payload calculates them from trigger button coordinates.
  
  return (
    <ConfirmDialogProvider>
      <ChunkReloadGuard />
      {children}
    </ConfirmDialogProvider>
  )
}
