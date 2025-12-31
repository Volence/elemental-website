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
    <div className="logout-button">
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="logout-button__btn"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="logout-button__icon"
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
