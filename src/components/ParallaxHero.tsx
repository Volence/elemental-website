'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface ParallaxHeroProps {
  imageSrc: string
  imageAlt: string
  children: React.ReactNode
  className?: string
  parallaxSpeed?: number // 0 = no effect, 0.5 = slow, 1 = matches scroll
}

/**
 * Hero section with parallax scrolling effect on background image
 */
export function ParallaxHero({
  imageSrc,
  imageAlt,
  children,
  className = '',
  parallaxSpeed = 0.4,
}: ParallaxHeroProps) {
  const [offset, setOffset] = useState(0)
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return
      
      const rect = heroRef.current.getBoundingClientRect()
      const scrolled = -rect.top
      
      // Only apply parallax when hero is visible
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        setOffset(scrolled * parallaxSpeed)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [parallaxSpeed])

  return (
    <section 
      ref={heroRef}
      className={`relative w-full h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden ${className}`}
    >
      <div 
        className="absolute inset-0 z-0"
        style={{
          transform: `translateY(${offset}px) scale(1.1)`, // Scale to prevent gaps during parallax
          transformOrigin: 'center center',
        }}
      >
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
      </div>
      {children}
    </section>
  )
}
