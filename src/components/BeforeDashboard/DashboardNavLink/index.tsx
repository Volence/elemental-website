'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

/**
 * Custom navigation link component that adds a "Dashboard" link to the admin sidebar
 * This appears at the top of the navigation, allowing users to return to the dashboard from any page
 */
const DashboardNavLink: React.FC = () => {
  const pathname = usePathname()
  const isDashboard = pathname === '/admin' || pathname === '/admin/'

  return (
    <div className="dashboard-nav-link">
      <Link
        href="/admin"
        className={`dashboard-nav-link__link ${isDashboard ? 'dashboard-nav-link__link--active' : ''}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="dashboard-nav-link__icon"
        >
          <path
            d="M2 2H7V7H2V2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 2H14V7H9V2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 9H7V14H2V9Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 9H14V14H9V9Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Dashboard
      </Link>
    </div>
  )
}

export default DashboardNavLink
