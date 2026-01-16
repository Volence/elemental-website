'use client'

import React, { useEffect } from 'react'
import { Button, useFormFields, useDocumentInfo } from '@payloadcms/ui'
import { useFaceitSync } from '@/hooks/useFaceitSync'

export default function FaceitSyncButton({ value, ...props }: any) {
  // Get document ID from the document context (more reliable for saved documents)
  const { id: docId } = useDocumentInfo()
  
  // Get form field values
  const currentFaceitLeague = useFormFields(([fields]) => fields.currentFaceitLeague)
  const faceitTeamId = useFormFields(([fields]) => fields.faceitTeamId)
  const teamIdField = useFormFields(([fields]) => fields.id)
  
  // Use document ID if available, otherwise fall back to form field
  const teamId = docId || teamIdField?.value
  
  // Get league ID from form field (handle both ID and object formats)
  const leagueId = currentFaceitLeague?.value
    ? typeof currentFaceitLeague.value === 'object'
      ? (currentFaceitLeague.value as { id: number }).id
      : currentFaceitLeague.value
    : undefined

  // Use the custom hook for all sync logic
  const {
    syncing,
    message,
    error,
    leagueData,
    lastSynced,
    sync,
  } = useFaceitSync({
    teamId,
    faceitTeamId: faceitTeamId?.value as string | undefined,
    leagueId,
  })

  const handleSync = async () => {
    await sync()
    // Refresh page after 2 seconds on success
    if (!error) {
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }
  
  return (
    <div className="faceit-sync-button">
      {currentFaceitLeague?.value && !leagueData && (
        <div className="faceit-sync-button__status faceit-sync-button__status--loading">
          ⏳ Loading league configuration...
        </div>
      )}
      
      {leagueData && !message && (
        <div className="faceit-sync-button__status faceit-sync-button__status--ready">
          ✓ Ready to sync: {leagueData.name}
        </div>
      )}
      
      {syncing && (
        <div className="faceit-sync-button__status faceit-sync-button__status--syncing">
          {message || 'Syncing with FaceIt API...'}
        </div>
      )}
      
      <Button
        onClick={handleSync}
        disabled={syncing || !leagueData}
        buttonStyle="primary"
      >
        {syncing ? 'Syncing...' : '🔄 Sync from FaceIt Now'}
      </Button>
      
      {lastSynced && !syncing && !message && (
        <div style={{ 
          marginTop: '0.75rem', 
          fontSize: '0.8125rem', 
          color: 'rgba(255, 255, 255, 0.5)',
          fontStyle: 'italic'
        }}>
          Last synced: {new Date(lastSynced).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}
        </div>
      )}
      
      {message && !syncing && (
        <div className={`faceit-sync-button__status faceit-sync-button__status--${error ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
      
      <div className="faceit-sync-button__description">
        <p>This will:</p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Fetch current standings from FaceIt for the selected league</li>
          <li>Update or create match records with correct dates/times</li>
          <li>Pull opponent names and FaceIt lobby room links</li>
          <li>Update season data (rank, W-L record, points)</li>
        </ul>
        <p style={{ marginTop: '0.5rem' }}>
          <strong>Note:</strong> Make sure you've selected a FaceIt League above and saved the team first.
        </p>
      </div>
    </div>
  )
}
