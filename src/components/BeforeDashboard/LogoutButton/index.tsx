'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Logout button component for the Payload admin panel
 * Can be placed in the sidebar navigation or dashboard
 */
const LogoutButton: React.FC = () => {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    
    setIsLoggingOut(true)
    
    try {
      // Call Payload's logout endpoint
      const response = await fetch('/api/users/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok || response.status === 200) {
        // Redirect to login page
        router.push('/admin/login')
        router.refresh()
      } else {
        // If logout endpoint doesn't work, try clearing session and redirecting
        console.warn('Logout endpoint returned non-200 status, redirecting anyway')
        router.push('/admin/login')
        router.refresh()
      }
    } catch (error) {
      console.error('Error during logout:', error)
      // Still redirect to login page even if there's an error
      router.push('/admin/login')
      router.refresh()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div style={{ margin: 0 }}>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          width: '100%',
          padding: '0.5rem 0.75rem',
          color: 'var(--theme-text-500, rgba(255, 255, 255, 0.7))',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoggingOut ? 'not-allowed' : 'pointer',
          fontWeight: 400,
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          transition: 'all 0.15s ease',
          margin: 0,
          opacity: isLoggingOut ? 0.6 : 1,
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          if (!isLoggingOut) {
            e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100, rgba(255, 255, 255, 0.05))'
            e.currentTarget.style.color = 'var(--theme-text)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoggingOut) {
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
            d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 11L13 8L10 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13 8H6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {isLoggingOut ? 'Logging out...' : 'Log Out'}
      </button>
    </div>
  )
}

export default LogoutButton
