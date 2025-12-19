'use client'

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
  sizes,
  priority = false,
}: TeamLogoProps) {
  // Normalize the src path (ensure it starts with / and handle any issues)
  const normalizedSrc = src?.startsWith('/') ? src : `/${src}`

  // Use regular img tag instead of Next.js Image for static logos
  const style = fill 
    ? { width: '100%', height: '100%', objectFit: 'contain' as const }
    : width && height 
      ? { width: `${width}px`, height: `${height}px`, objectFit: 'contain' as const }
      : { objectFit: 'contain' as const }

  if (fill) {
    return (
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        style={style}
        loading={priority ? 'eager' : 'lazy'}
      />
    )
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      style={style}
      loading={priority ? 'eager' : 'lazy'}
    />
  )
}
