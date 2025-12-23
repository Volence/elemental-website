'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80" {...(theme ? { 'data-theme': theme } : {})}>
      <div className="container">
        <div className="py-6 flex justify-between items-center">
          <Link href="/" className="transition-opacity hover:opacity-80 duration-200">
            <Logo loading="eager" priority="high" className="invert dark:invert-0 scale-110" />
          </Link>
          <HeaderNav data={data} />
        </div>
      </div>
      {/* Colorful gradient border */}
      <div className="h-0.5 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] shadow-[0_0_20px_rgba(56,189,248,0.3)]" />
    </header>
  )
}
