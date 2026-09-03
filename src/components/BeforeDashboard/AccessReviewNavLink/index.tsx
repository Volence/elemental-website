'use client'

import React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import type { Person } from '@/payload-types'

/**
 * Sidebar link to the Access Review tab of System Health. Admin only, matching the page's own gate -
 * role, department and team access can only be changed by admins.
 */
const AccessReviewNavLink: React.FC = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth<Person>()
  const isActive = pathname === '/admin/globals/system-health' && searchParams?.get('tab') === 'access'

  if (!user || (user as any).role !== 'admin') return null

  return (
    <div className="calendar-nav-link">
      <Link
        href="/admin/globals/system-health?tab=access"
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
