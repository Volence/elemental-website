'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const pathname = usePathname()
  const navItems = data?.navItems || []
  const [isOpen, setIsOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

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
                text-sm font-medium transition-all relative py-1
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm px-2
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

      {/* Mobile Menu Button */}
      <button
        className="md:hidden p-2 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div
          id="mobile-menu"
          className="md:hidden fixed inset-0 top-[73px] z-50 bg-background/95 backdrop-blur-lg"
          role="dialog"
          aria-modal="true"
        >
          <nav className="container h-full py-8" aria-label="Mobile navigation">
            <div className="flex flex-col gap-2">
              {staticNavLinks.map(({ label, href }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`
                      text-lg font-medium transition-all py-4 px-4 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-primary
                      ${active 
                        ? 'text-primary font-bold bg-primary/10 border-l-4 border-l-primary' 
                        : 'text-foreground hover:text-primary hover:bg-accent'
                      }
                    `}
                    aria-current={active ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                )
              })}
              {filteredNavItems.map(({ link }, i) => {
                return (
                  <div key={i} className="py-4 px-4">
                    <CMSLink {...link} appearance="link" />
                  </div>
                )
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
