'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import type { User } from '@/payload-types'

/**
 * Sidebar nav link that gives players (and others with linkedPerson)
 * a direct "My Profile" edit link instead of browsing the full People list.
 */
const MyProfileNavLink: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuth<User>()

  if (!user) return null

  // Only show for non-admin roles that have a linkedPerson
  const role = (user.role as string) ?? ''
  const isFullAccess = ['admin', 'staff-manager', 'team-manager'].includes(role)

  // Full-access users already see People in the Organization nav group
  if (isFullAccess) return null

  const linkedPersonId = typeof user.linkedPerson === 'object' && user.linkedPerson !== null
    ? user.linkedPerson.id
    : user.linkedPerson

  if (!linkedPersonId) return null

  const profileHref = `/admin/my-profile`
  const isActive = pathname ? pathname === profileHref : false

  return (
    <>
      {/* Hide the redundant Organization nav group — players use Edit Profile instead */}
      <style>{`.nav-group.Organization { display: none !important; }`}</style>
      <div className="nav-group" id="nav-group-My-Profile">
        <button
          className="nav-group__toggle nav-group__toggle--open"
          type="button"
          tabIndex={-1}
        >
          <div className="nav-group__label">My Profile</div>
          <div className="nav-group__indicator" />
        </button>
        <div className="nav-group__content">
          <Link
            href={profileHref}
            className={`nav__link${isActive ? ' active' : ''}`}
            id="nav-my-profile"
          >
            <span className="nav__link-label">Edit Profile</span>
          </Link>
        </div>
      </div>
    </>
  )
}

export default MyProfileNavLink
