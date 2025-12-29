'use client'

import React, { useState } from 'react'
import { Button } from '@payloadcms/ui'

export default function FaceitSyncButton({ value, ...props }: any) {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  
  const teamId = props?.path?.split('/')[0] // Extract team ID from path
  
  const handleSync = async () => {
    if (!teamId) {
      setMessage('Error: Could not determine team ID')
      setError(true)
      return
    }
    
    try {
      setSyncing(true)
      setMessage('Syncing with FaceIt API...')
      setError(false)
      
      const response = await fetch(`/api/faceit/sync/${teamId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      
      if (result.success) {
        setMessage(`✓ Sync successful! Updated ${result.matchesUpdated || 0} matches, created ${result.matchesCreated || 0} new matches.`)
        setError(false)
        
        // Refresh page after 2 seconds to show updated data
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setMessage(`✗ Sync failed: ${result.error || 'Unknown error'}`)
        setError(true)
      }
    } catch (err: any) {
      setMessage(`✗ Error: ${err.message || 'Failed to sync'}`)
      setError(true)
    } finally {
      setSyncing(false)
    }
  }
  
  return (
    <div style={{ marginTop: '1rem' }}>
      <Button
        onClick={handleSync}
        disabled={syncing}
        buttonStyle="primary"
      >
        {syncing ? 'Syncing...' : '🔄 Sync from FaceIt Now'}
      </Button>
      
      {message && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            borderRadius: '4px',
            backgroundColor: error ? '#fee' : '#efe',
            border: `1px solid ${error ? '#fcc' : '#cfc'}`,
            color: error ? '#c33' : '#363',
          }}
        >
          {message}
        </div>
      )}
      
      <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#666' }}>
        <p>This will:</p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Fetch current standings from FaceIt</li>
          <li>Update or create match records</li>
          <li>Pull opponent names and room links</li>
          <li>Update season data</li>
        </ul>
        <p style={{ marginTop: '0.5rem' }}>
          <strong>Note:</strong> Existing match data will be preserved. Only opponent names and FaceIt-specific fields will be updated.
        </p>
      </div>
    </div>
  )
}

