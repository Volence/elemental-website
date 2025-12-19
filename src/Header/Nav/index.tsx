'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const pathname = usePathname()
  const navItems = data?.navItems || []

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
    <nav className="flex gap-6 items-center">
      {staticNavLinks.map(({ label, href }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            className={`
              text-sm font-medium transition-all relative py-1
              ${active 
                ? 'text-primary font-bold' 
                : 'text-foreground hover:text-primary'
              }
            `}
          >
            {label}
            {active && (
              <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </Link>
        )
      })}
      {filteredNavItems.map(({ link }, i) => {
        return <CMSLink key={i} {...link} appearance="link" />
      })}
    </nav>
  )
}
