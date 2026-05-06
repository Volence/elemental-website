'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import type { Person, Media } from '@/payload-types'

/**
 * Custom avatar component for the admin panel header
 * Uses the user's uploaded avatar from the Users collection
 */
export const UserAvatar: React.FC = () => {
  const { user } = useAuth()
  const typedUser = user as Person | undefined

  if (!typedUser) return null

  // Get avatar URL
  let avatarUrl: string | null = null
  if (typedUser.avatar && typeof typedUser.avatar === 'object' && 'url' in typedUser.avatar) {
    avatarUrl = (typedUser.avatar as Media).url || null
  }

  if (!avatarUrl) {
    // Fallback to default avatar (first letter of name)
    const initial = typedUser.name ? typedUser.name.charAt(0).toUpperCase() : '?'
    return (
      <div className="user-avatar user-avatar--initial">
        {initial}
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt={typedUser.name || 'Person avatar'}
      className="user-avatar"
    />
  )
}

export default UserAvatar


