'use client'

import Image from 'next/image'
import { getLogoUrl } from '@/utilities/getLogoUrl'

interface TeamLogoProps {
  src: unknown // Accept any type - could be string, number, or object from relationship
  alt: string
  className?: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  logoFilename?: string | null // Cached filename from Teams collection for fallback
}

export function TeamLogo({
  src,
  alt,
  className,
  fill = false,
  width,
  height,
  sizes = '(max-width: 640px) 80px, (max-width: 768px) 100px, 120px',
  priority = false,
  logoFilename,
}: TeamLogoProps) {
  // Use getLogoUrl to normalize any input (string, number ID, or object)
  // Pass logoFilename as fallback for when logo is just an ID
  const resolvedUrl = getLogoUrl(src, { logoFilename })
  // Ensure it starts with /
  const normalizedSrc = resolvedUrl.startsWith('/') ? resolvedUrl : `/${resolvedUrl}`

  if (fill) {
    return (
      <Image
        src={normalizedSrc}
        alt={alt}
        fill
        className={`object-contain ${className || ''}`}
        sizes={sizes}
        priority={priority}
        loading="eager"
      />
    )
  }

  return (
    <Image
      src={normalizedSrc}
      alt={alt}
      width={width || 120}
      height={height || 120}
      className={`object-contain ${className || ''}`}
      sizes={sizes}
      priority={priority}
      loading="eager"
    />
  )
}

