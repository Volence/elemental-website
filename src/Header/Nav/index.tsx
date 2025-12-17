'use client'

import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
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

  return (
    <nav className="flex gap-4 items-center">
      {staticNavLinks.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className="text-sm font-medium hover:text-primary transition-colors"
        >
          {label}
        </Link>
      ))}
      {filteredNavItems.map(({ link }, i) => {
        return <CMSLink key={i} {...link} appearance="link" />
      })}
    </nav>
  )
}
