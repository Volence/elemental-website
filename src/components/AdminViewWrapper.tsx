'use client'

import React from 'react'

/**
 * Wrapper component that provides the admin layout shell for custom views.
 * This ensures custom pages registered via admin.components.views get the
 * sidebar, header, and proper admin styling.
 */
export const AdminViewWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="template-default">
      <div className="app">
        {children}
      </div>
    </div>
  )
}

