'use client'

import React from 'react'

/**
 * Custom logo for admin panel
 * Shows Elemental branding instead of just emoji
 */
const AdminLogo: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <img 
        src="/logos/org.png" 
        alt="Elemental"
        style={{
          height: '32px',
          width: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

export default AdminLogo
