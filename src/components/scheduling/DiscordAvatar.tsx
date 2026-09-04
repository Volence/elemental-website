'use client'

import React, { useEffect, useState } from 'react'
import { discordAvatarUrl } from '@/utilities/discordAvatarUrl'

/**
 * Discord avatar with a graceful fallback. `avatar` is whatever People stores
 * (a bare hash since the Discord login, a full URL before that); the CDN URL is
 * built from it and the Discord ID. Bare hashes used as <img src> were the
 * broken-image icons next to names in the scheduler. A stale hash (player
 * changed their picture, has not logged in since) 404s, so on error, or with
 * no avatar at all, show the player's initial instead.
 */
export function DiscordAvatar({
  discordId,
  avatar,
  name,
  size,
  className,
}: {
  discordId?: string | null
  avatar?: string | null
  name: string
  size: number
  className?: string
}) {
  const src = discordAvatarUrl(discordId, avatar, size > 32 ? 64 : 32)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  if (src && !failed) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={src}
        alt=""
        width={size}
        height={size}
        className={className}
        onError={() => setFailed(true)}
      />
    )
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={`${className ?? ''} discord-avatar--fallback`.trim()}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.5)) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}
