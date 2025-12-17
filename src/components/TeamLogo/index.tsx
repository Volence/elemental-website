'use client'

import { useState, useEffect } from 'react'

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

const FALLBACK_LOGO = '/logos/org.png'

export function TeamLogo({
  src,
  alt,
  className,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
}: TeamLogoProps) {
  // Normalize the src path (ensure it starts with / and handle any issues)
  const normalizedSrc = src?.startsWith('/') ? src : `/${src}`
  const [imgSrc, setImgSrc] = useState(normalizedSrc)
  const [hasError, setHasError] = useState(false)

  // Reset error state when src changes
  useEffect(() => {
    setImgSrc(normalizedSrc)
    setHasError(false)
  }, [normalizedSrc])

  const handleError = () => {
    // Log error in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[TeamLogo] Failed to load image: ${imgSrc}, falling back to ${FALLBACK_LOGO}`)
    }
    
    if (imgSrc !== FALLBACK_LOGO && !hasError) {
      setHasError(true)
      setImgSrc(FALLBACK_LOGO)
    }
  }

  // Use regular img tag instead of Next.js Image for static logos
  // This avoids Next.js image optimization issues that can cause fallbacks
  const style = fill 
    ? { width: '100%', height: '100%', objectFit: 'contain' as const }
    : width && height 
      ? { width: `${width}px`, height: `${height}px`, objectFit: 'contain' as const }
      : { objectFit: 'contain' as const }

  if (fill) {
    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        style={style}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
      />
    )
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      style={style}
      onError={handleError}
      loading={priority ? 'eager' : 'lazy'}
    />
  )
}

