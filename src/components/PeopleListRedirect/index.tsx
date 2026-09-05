'use client'

import React, { useEffect } from 'react'
import { useAccess } from '@/access/useAccess'

/**
 * Injects into the People list view to redirect row clicks
 * to the custom PersonEditor instead of the default Payload form.
 */
const PeopleListRedirect: React.FC = () => {
  const { access } = useAccess()
  const isManager = access?.canManagePeople ?? false

  useEffect(() => {
    if (!isManager) return

    // Intercept clicks on table rows to redirect to custom editor
    const handleClick = (e: MouseEvent) => {
      // Respect new-tab/window intent - never hijack modified clicks.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

      const target = e.target as HTMLElement
      const link = target.closest('a[href*="/admin/collections/people/"]')
      if (!link) return
      if ((link as HTMLAnchorElement).target === '_blank') return

      const href = link.getAttribute('href') ?? ''
      const match = href.match(/\/admin\/collections\/people\/(\d+)/)
      if (!match) return

      e.preventDefault()
      e.stopPropagation()
      window.location.href = `/admin/edit-person?id=${match[1]}`
    }

    // Use capture phase to intercept before Payload's navigation
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isManager])

  return null
}

export default PeopleListRedirect
