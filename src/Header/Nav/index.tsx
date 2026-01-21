'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navItems = data?.navItems || []

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Filter out Posts and Contact links
  const filteredNavItems = navItems.filter(({ link }) => {
    if (link?.type === 'custom' && link?.url) {
      const url = link.url.toLowerCase()
      return !url.includes('/posts') && !url.includes('/contact')
    }
    if (link?.type === 'reference' && typeof link?.reference?.value === 'object') {
      const slug = link.reference.value.slug?.toLowerCase() || ''
      return slug !== 'posts' && slug !== 'contact'
    }
    return true
  })

  // Static navigation links
  const staticNavLinks = [
    { label: 'Teams', href: '/teams' },
    { label: 'Matches', href: '/matches' },
    { label: 'Seminars', href: '/seminars' },
    { label: 'Calendar', href: '/calendar' },
    { label: 'Staff', href: '/staff' },
  ]

  // Check if a path is active (exact match or starts with the path)
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex gap-6 items-center" aria-label="Main navigation">
        {staticNavLinks.map(({ label, href }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                text-sm font-medium transition-all relative py-1 px-2 rounded-sm
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                ${active 
                  ? 'text-primary font-bold' 
                  : 'text-foreground hover:text-primary'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              {label}
              {active && (
                <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-primary rounded-full" aria-hidden="true" />
              )}
            </Link>
          )
        })}
        {filteredNavItems.map(({ link }, i) => {
          return <CMSLink key={i} {...link} appearance="link" />
        })}
      </nav>

      {/* Mobile Hamburger Button */}
      <button
        type="button"
        className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
      >
        <span 
          className={`block w-6 h-0.5 bg-foreground transition-transform duration-200 ${
            mobileOpen ? 'rotate-45 translate-y-2' : ''
          }`} 
        />
        <span 
          className={`block w-6 h-0.5 bg-foreground transition-opacity duration-200 ${
            mobileOpen ? 'opacity-0' : ''
          }`} 
        />
        <span 
          className={`block w-6 h-0.5 bg-foreground transition-transform duration-200 ${
            mobileOpen ? '-rotate-45 -translate-y-2' : ''
          }`} 
        />
      </button>

      {/* Mobile Dropdown Menu */}
      {mobileOpen && (
        <div 
          className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border shadow-lg"
        >
          <nav className="container py-4 flex flex-col gap-2" aria-label="Mobile navigation">
            {staticNavLinks.map(({ label, href }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    text-base font-medium py-3 px-4 rounded-lg transition-colors
                    ${active 
                      ? 'text-primary bg-primary/10 font-bold' 
                      : 'text-foreground hover:bg-muted'
                    }
                  `}
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </Link>
              )
            })}
            {filteredNavItems.map(({ link }, i) => {
              return (
                <div key={i} className="py-3 px-4" onClick={() => setMobileOpen(false)}>
                  <CMSLink {...link} appearance="link" />
                </div>
              )
            })}
          </nav>
        </div>
      )}
    </>
  )
}
