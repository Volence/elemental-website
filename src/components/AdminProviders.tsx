'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'

/**
 * AdminProviders - Wraps all admin pages and provides shared functionality
 * 
 * Currently provides:
 * - Sidebar scroll position preservation across navigation
 * - Doc-controls popup position fix (Payload sets wrong position via JS)
 * - Global account avatar → custom user editor redirect
 */
export default function AdminProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFirstRender = useRef(true)
  const { user } = useAuth<User>()
  
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

  // Global: intercept navigation to custom admin views
  useEffect(() => {
    if (!user?.id) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a') as HTMLAnchorElement | null
      if (!link) return
      const href = link.getAttribute('href') ?? ''

      // Account avatar → custom user editor (admins) or my-profile (everyone else)
      if (href === '/admin/account') {
        e.preventDefault()
        e.stopPropagation()
        if (user.role === 'admin') {
          window.location.href = `/admin/edit-user?id=${user.id}`
        } else {
          window.location.href = '/admin/my-profile'
        }
        return
      }

      // Invite Links: create → custom editor
      if (href === '/admin/collections/invite-links/create') {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = '/admin/edit-invite'
        return
      }

      // Invite Links: edit → custom editor
      const inviteMatch = href.match(/\/admin\/collections\/invite-links\/(\d+)/)
      if (inviteMatch) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-invite?id=${inviteMatch[1]}`
        return
      }

      // Users: edit → custom editor
      const userMatch = href.match(/\/admin\/collections\/users\/(\d+)/)
      if (userMatch) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-user?id=${userMatch[1]}`
        return
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
      '/admin/manage-users': '/collections/users',
      '/admin/edit-user': '/collections/users',
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
  // Do NOT override popup positions — Payload calculates them from trigger button coordinates.
  
  return <>{children}</>
}
