import React from 'react'
import type { Person } from '@/payload-types'

interface AccessDeniedProps {
  user: Person | null | undefined
}

export function AccessDenied({ user }: AccessDeniedProps) {
  return (
    <div className="access-denied">
      <h1>Access Denied</h1>
      <p>Only users with the "Admin" role can access this page.</p>
      {user && (
        <p className="access-denied__role-info">
          Your current role: <strong>{user.role || 'None'}</strong>
        </p>
      )}
    </div>
  )
}
