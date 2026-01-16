'use client'

import React from 'react'
import { useDocumentInfo, Button } from '@payloadcms/ui'

/**
 * Button to open the Opponent Wiki view for the current team
 */
export default function ViewWikiButton() {
  const { id } = useDocumentInfo()

  if (!id) {
    return null
  }

  const handleClick = () => {
    // Open wiki in current tab
    window.location.href = `/admin/globals/opponent-wiki?team=${id}`
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <Button
        buttonStyle="secondary"
        onClick={handleClick}
        size="medium"
      >
        📖 View in Wiki
      </Button>
    </div>
  )
}
