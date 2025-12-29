'use client'

import React, { useState, useEffect } from 'react'
import { Button, useFormFields, useDocumentInfo } from '@payloadcms/ui'

export default function FaceitSyncButton({ value, ...props }: any) {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [leagueData, setLeagueData] = useState<any>(null)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  
  // Get document ID from the document context (more reliable for saved documents)
  const { id: docId } = useDocumentInfo()
  
  // Get form field values
  const currentFaceitLeague = useFormFields(([fields]) => fields.currentFaceitLeague)
  const faceitTeamId = useFormFields(([fields]) => fields.faceitTeamId)
  const teamIdField = useFormFields(([fields]) => fields.id)
  
  // Use document ID if available, otherwise fall back to form field
  const teamId = docId || teamIdField?.value
  
  // Fetch league data when league is selected
  useEffect(() => {
    if (currentFaceitLeague?.value) {
      // Handle both ID and object formats
      const leagueId = typeof currentFaceitLeague.value === 'object' 
        ? (currentFaceitLeague.value as { id: number }).id 
        : currentFaceitLeague.value
      
      console.log('[FaceitSyncButton] Fetching league data for ID:', leagueId)
      
      fetch(`/api/faceit-leagues/${leagueId}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch league: ${res.status}`)
          return res.json()
        })
        .then(data => {
          console.log('[FaceitSyncButton] League data fetched:', data)
          setLeagueData(data)
        })
        .catch(err => {
          console.error('[FaceitSyncButton] Error fetching league data:', err)
          setMessage(`Error loading league data: ${err.message}`)
          setError(true)
        })
    } else {
      setLeagueData(null)
    }
  }, [currentFaceitLeague?.value])
  
  // Fetch last synced time
  useEffect(() => {
    async function fetchLastSynced() {
      if (!teamId) return
      
      try {
        const response = await fetch(`/api/faceit-seasons?where[team][equals]=${teamId}&where[isActive][equals]=true&limit=1`)
        const data = await response.json()
        
        if (data.docs && data.docs.length > 0 && data.docs[0].lastSynced) {
          setLastSynced(data.docs[0].lastSynced)
        }
      } catch (err) {
        console.error('[FaceitSyncButton] Error fetching last synced:', err)
      }
    }
    
    fetchLastSynced()
  }, [teamId])
  
  const handleSync = async () => {
    console.log('[FaceitSyncButton] Sync clicked:', {
      teamId: teamId,
      docId: docId,
      faceitTeamId: faceitTeamId?.value,
      leagueData: leagueData,
      currentFaceitLeague: currentFaceitLeague?.value
    })
    
    if (!teamId || !faceitTeamId?.value || !leagueData) {
      const missing = []
      if (!teamId) missing.push('You must SAVE the team first before syncing')
      if (!faceitTeamId?.value) missing.push('FaceIt Team ID is required')
      if (!leagueData) missing.push('League data not loaded (try refreshing page)')
      
      setMessage(`Error: ${missing.join(' • ')}`)
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
        body: JSON.stringify({
          faceitTeamId: faceitTeamId.value,
          championshipId: leagueData.championshipId,
          leagueId: leagueData.leagueId,
          seasonId: leagueData.seasonId,
          stageId: leagueData.stageId,
        }),
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

