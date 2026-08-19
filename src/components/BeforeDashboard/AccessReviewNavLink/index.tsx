'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import type { Person } from '@/payload-types'

/**
 * Sidebar link to the Access Review page. Admin only, matching the page's own gate -
 * role, department and team access can only be changed by admins.
 */
const AccessReviewNavLink: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuth<Person>()
  const isActive = pathname === '/admin/access-review'

  if (!user || (user as any).role !== 'admin') return null

  return (
    <div className="calendar-nav-link">
      <Link
        href="/admin/access-review"
        className={`calendar-nav-link__link ${isActive ? 'calendar-nav-link__link--active' : ''}`}
        id="nav-access-review"
      >
        <ShieldAlert size={18} className="calendar-nav-link__icon" />
        Access Review
      </Link>
    </div>
  )
}

export default AccessReviewNavLink
