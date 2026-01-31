'use client'

import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'

interface YouTubeFacadeProps {
  videoId: string
  playlistId?: string
  title: string
  className?: string
}

/**
 * YouTube Facade Component
 * 
 * Shows a static thumbnail initially, loads the actual iframe only on user interaction.
 * This dramatically improves LCP and Best Practices scores by:
 * 1. Not loading 3rd party scripts until needed
 * 2. Showing content immediately via static image
 * 3. Avoiding YouTube's deprecated APIs until user engages
 */
export function YouTubeFacade({
  videoId,
  playlistId,
  title,
  className = '',
}: YouTubeFacadeProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  const handleClick = useCallback(() => {
    setIsLoaded(true)
  }, [])

  // Build the embed URL
  const embedUrl = playlistId
    ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}&rel=0&modestbranding=1&autoplay=1`
    : `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`

  // YouTube thumbnail URL (maxresdefault for highest quality)
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  if (isLoaded) {
    return (
      <iframe
        className={className}
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`group cursor-pointer bg-black ${className}`}
      aria-label={`Play ${title}`}
      type="button"
    >
      {/* Thumbnail */}
      <Image
        src={thumbnailUrl}
        alt={title}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 1200px"
        priority
      />
      
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />
      
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-red-500 transition-all duration-300">
          <Play className="w-10 h-10 text-white fill-white ml-1" />
        </div>
      </div>
      
      {/* Accessible text */}
      <span className="sr-only">Play {title}</span>
    </button>
  )
}
