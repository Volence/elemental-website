'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

/**
 * Navigation link for Organization Calendar in the admin sidebar
 * Appears below Dashboard link
 */
const CalendarNavLink: React.FC = () => {
  const pathname = usePathname()
  const isActive = pathname === '/admin/globals/organization-calendar'

  return (
    <div className="calendar-nav-link">
      <Link
        href="/admin/globals/organization-calendar"
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
          <rect
            x="2"
            y="3"
            width="12"
            height="11"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M2 6H14"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M5 1V4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M11 1V4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Organization Calendar
      </Link>
    </div>
  )
}

export default CalendarNavLink
