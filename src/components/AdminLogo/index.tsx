'use client'

import React from 'react'

/**
 * Custom logo for admin panel
 * Shows Elemental branding instead of just emoji
 */
const AdminLogo: React.FC = () => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '0.5rem',
      height: '100%',
    }}>
      <img 
        src="/logos/org.png" 
        alt="Elemental"
        style={{
          height: '24px',
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  )
}

export default AdminLogo
