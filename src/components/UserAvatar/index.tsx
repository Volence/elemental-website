'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User, Media } from '@/payload-types'

/**
 * Custom avatar component for the admin panel header
 * Uses the user's uploaded avatar from the Users collection
 */
export const UserAvatar: React.FC = () => {
  const { user } = useAuth()
  const typedUser = user as User | undefined

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
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--theme-elevation-400)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: '600',
          color: 'white',
        }}
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt={typedUser.name || 'User avatar'}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        objectFit: 'cover',
      }}
    />
  )
}

export default UserAvatar


