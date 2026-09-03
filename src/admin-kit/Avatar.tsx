'use client'

import React, { useState } from 'react'
import { getInitials, withAvatarSize } from './format'

export type AvatarSize = 20 | 24 | 32 | 40 | 56

export interface AvatarProps {
  src?: string | null
  name: string | null | undefined
  size?: AvatarSize
  className?: string
}

/**
 * Person avatar with a two-letter initials fallback. Sets width/height (no
 * layout shift), lazy loads, and requests the right size from the Discord CDN.
 */
export function Avatar({ src, name, size = 32, className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const label = name?.trim() || 'Unknown person'
  const url = failed ? null : withAvatarSize(src ?? null, size >= 40 ? 128 : 64)

  return (
    <span
      className={`kit-avatar kit-avatar--${size}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      title={label}
    >
      {url ? (
        <img
          src={url}
          alt={label}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="kit-avatar__initials" aria-label={label} role="img">
          {getInitials(name)}
        </span>
      )}
    </span>
  )
}

export default Avatar
