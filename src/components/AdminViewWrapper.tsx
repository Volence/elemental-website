'use client'

import React from 'react'
import { NavToggler, Nav } from '@payloadcms/ui'

/**
 * Wrapper component that provides the admin layout shell for custom views.
 * Manually includes the sidebar navigation and proper layout structure.
 */
export const AdminViewWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="template-default">
      <NavToggler />
      <div className="app">
        <Nav />
        <main className="doc-controls">
          <div className="doc-controls__wrapper">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

