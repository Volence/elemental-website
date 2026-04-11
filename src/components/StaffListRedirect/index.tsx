'use client'

import React, { useEffect } from 'react'

/**
 * Intercepts row clicks on the Organization Staff / Production list
 * to redirect to the custom Staff editor. Does NOT redirect the list itself.
 */
const StaffListRedirect: React.FC = () => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href*="/admin/collections/organization-staff/"], a[href*="/admin/collections/production/"]')
      if (!link) return

      const href = link.getAttribute('href') ?? ''
      const orgMatch = href.match(/\/admin\/collections\/organization-staff\/(\d+)/)
      const prodMatch = href.match(/\/admin\/collections\/production\/(\d+)/)

      if (orgMatch) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-staff?type=org&id=${orgMatch[1]}`
      } else if (prodMatch) {
        e.preventDefault()
        e.stopPropagation()
        window.location.href = `/admin/edit-staff?type=production&id=${prodMatch[1]}`
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}

export default StaffListRedirect
