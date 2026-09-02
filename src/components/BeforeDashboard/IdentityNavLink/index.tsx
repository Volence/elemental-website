'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { Fingerprint } from 'lucide-react'
import type { Person } from '@/payload-types'

/**
 * Sidebar link to the Identity page. Admin or staff-manager, matching the page's own gate -
 * linking legacy people to Discord, claim review, and merges are identity-management actions.
 */
const IdentityNavLink: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuth<Person>()
  const isActive = pathname === '/admin/identity'

  if (!user || !['admin', 'staff-manager'].includes((user as any).role)) return null

  return (
    <div className="calendar-nav-link">
      <Link
        href="/admin/identity"
        className={`calendar-nav-link__link ${isActive ? 'calendar-nav-link__link--active' : ''}`}
        id="nav-identity"
      >
        <Fingerprint size={18} className="calendar-nav-link__icon" />
        Identity
      </Link>
    </div>
  )
}

export default IdentityNavLink
