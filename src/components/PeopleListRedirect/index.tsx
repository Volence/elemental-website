'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'

/**
 * Injects into the People list view to redirect row clicks
 * to the custom PersonEditor instead of the default Payload form.
 */
const PeopleListRedirect: React.FC = () => {
  const { user } = useAuth<User>()
  const role = (user?.role as string) ?? ''
  const isManager = ['admin', 'staff-manager', 'team-manager'].includes(role)

  useEffect(() => {
    if (!isManager) return

    // Intercept clicks on table rows to redirect to custom editor
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href*="/admin/collections/people/"]')
      if (!link) return

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
