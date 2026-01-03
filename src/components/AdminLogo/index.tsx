'use client'

import React from 'react'

/**
 * Custom logo for admin panel
 * Shows Elemental branding instead of just emoji
 */
const AdminLogo: React.FC = () => {
  return (
    <div className="admin-logo">
      <img 
        src="/logos/org.png" 
        alt="Elemental"
        className="admin-logo__img"
      />
    </div>
  )
}

export default AdminLogo
