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
    <div style={{ margin: 0 }}>
      <Link
        href="/admin"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.5rem 0.75rem',
          color: isDashboard ? 'var(--theme-text)' : 'var(--theme-text-500, rgba(255, 255, 255, 0.7))',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: isDashboard ? 500 : 400,
          lineHeight: '1.25rem',
          backgroundColor: isDashboard ? 'var(--theme-elevation-200, rgba(255, 255, 255, 0.1))' : 'transparent',
          transition: 'all 0.15s ease',
          borderRadius: '4px',
          margin: 0,
        }}
        onMouseEnter={(e) => {
          if (!isDashboard) {
            e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100, rgba(255, 255, 255, 0.05))'
            e.currentTarget.style.color = 'var(--theme-text)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDashboard) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--theme-text-500, rgba(255, 255, 255, 0.7))'
          }
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
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
