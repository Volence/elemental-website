'use client'

import React, { useEffect } from 'react'

/**
 * Replaces the default edit view for InviteLinks collection.
 * Hides content immediately (no flash), then redirects to the custom editor.
 */
const InviteEditRedirect: React.FC = () => {
  useEffect(() => {
    const path = window.location.pathname
    const idMatch = path.match(/\/admin\/collections\/invite-links\/(\d+)/)
    if (idMatch) {
      window.location.replace(`/admin/edit-invite?id=${idMatch[1]}`)
    } else {
      window.location.replace('/admin/edit-invite')
    }
  }, [])

  // Return a full-screen blank overlay to prevent any flash
  return (
    <>
      <style>{`[class*="edit-view"], [class*="document-fields"], .render-fields { visibility: hidden !important; }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        Redirecting...
      </div>
    </>
  )
}

export default InviteEditRedirect
