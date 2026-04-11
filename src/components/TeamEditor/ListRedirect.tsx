'use client'

import React, { useEffect } from 'react'

/**
 * Intercepts row clicks on the Teams list to redirect
 * to the custom TeamEditor. Does NOT redirect the list itself.
 */
const TeamsListRedirect: React.FC = () => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href*="/admin/collections/teams/"]')
      if (!link) return
      const href = link.getAttribute('href') ?? ''

      // Create new
      if (href.endsWith('/teams/create')) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = '/admin/edit-team'
        return
      }

      // Edit existing
      const match = href.match(/\/admin\/collections\/teams\/(\d+)/)
      if (match) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-team?id=${match[1]}`
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}

export default TeamsListRedirect
