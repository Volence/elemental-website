'use client'

import React, { useEffect } from 'react'

/**
 * Intercepts row clicks on the Invite Links list to redirect
 * to the custom editor. Does NOT redirect the list itself.
 */
const InviteListRedirect: React.FC = () => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Respect new-tab/window intent - never hijack modified clicks.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

      const link = (e.target as HTMLElement).closest('a[href*="/admin/collections/invite-links/"]')
      if (!link) return
      if ((link as HTMLAnchorElement).target === '_blank') return
      const href = link.getAttribute('href') ?? ''

      // Create new
      if (href.endsWith('/invite-links/create')) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = '/admin/edit-invite'
        return
      }

      // Edit existing
      const match = href.match(/\/admin\/collections\/invite-links\/(\d+)/)
      if (match) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-invite?id=${match[1]}`
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}

export default InviteListRedirect
