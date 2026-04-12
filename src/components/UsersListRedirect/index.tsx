'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'

/**
 * Intercepts row clicks on the Users list to redirect
 * to the custom user editor. Does NOT redirect the list itself.
 * Also intercepts the top-right account avatar → custom editor.
 */
const UsersListRedirect: React.FC = () => {
  const { user } = useAuth<User>()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Intercept clicks on user rows → custom editor
      const link = target.closest('a[href*="/admin/collections/users/"]')
      if (link) {
        const href = link.getAttribute('href') ?? ''
        const match = href.match(/\/admin\/collections\/users\/(\d+)/)
        if (match) {
          e.preventDefault()
          e.stopPropagation()
          window.location.href = `/admin/edit-user?id=${match[1]}`
          return
        }
      }

      // Intercept top-right account avatar → custom editor for current user
      const accountLink = target.closest('a[href="/admin/account"]')
      if (accountLink && user?.id) {
        e.preventDefault()
        e.stopPropagation()
        if ((user as any).role === 'admin') {
          window.location.href = `/admin/edit-user?id=${user.id}`
        } else {
          window.location.href = '/admin/my-profile'
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [user])

  return null
}

export default UsersListRedirect
