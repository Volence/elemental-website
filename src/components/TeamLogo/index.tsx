'use client'

import Image from 'next/image'

interface TeamLogoProps {
  src: string
  alt: string
  className?: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
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
}: TeamLogoProps) {
  // Normalize the src path (ensure it starts with / and handle any issues)
  const normalizedSrc = src?.startsWith('/') ? src : `/${src}`

  if (fill) {
    return (
      <Image
        src={normalizedSrc}
        alt={alt}
        fill
        className={`object-contain ${className || ''}`}
        sizes={sizes}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
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
      loading={priority ? 'eager' : 'lazy'}
    />
  )
}

