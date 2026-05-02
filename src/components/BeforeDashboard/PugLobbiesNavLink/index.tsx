'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import type { User } from '@/payload-types'

const PugLobbiesNavLink: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuth<User>()
  const isActive = pathname === '/admin/pug-lobbies'

  if (!user) return null
  const u = user as any
  const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'
  if (!isPugAdmin) return null

  return (
    <div className="calendar-nav-link">
      <Link
        href="/admin/pug-lobbies"
        className={`calendar-nav-link__link ${isActive ? 'calendar-nav-link__link--active' : ''}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="calendar-nav-link__icon"
        >
          <rect x="3" y="5" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="9.5" r="1" fill="currentColor" />
        </svg>
        PUG Lobbies
      </Link>
    </div>
  )
}

export default PugLobbiesNavLink
