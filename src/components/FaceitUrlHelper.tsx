'use client'

import React, { useState } from 'react'
import { useForm } from '@payloadcms/ui'
import { parseFaceitUrl, isValidFaceitId } from '@/utilities/faceitUrlParser'

/**
 * FaceIt URL Helper Component
 * 
 * Makes it easy to fill in FaceIt season data by pasting URLs instead of manually entering IDs
 */
const FaceitUrlHelper: React.FC = () => {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { dispatchFields } = useForm()

  const handleParse = () => {
    setError('')
    setSuccess('')

    if (!url.trim()) {
      setError('Please enter a FaceIt URL')
      return
    }

    const parsed = parseFaceitUrl(url)
    let foundAny = false

    // Set team ID if found and valid
    if (parsed.teamId && isValidFaceitId(parsed.teamId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'faceitTeamId',
        value: parsed.teamId,
      })
      foundAny = true
    }

    // Set championship ID if found and valid
    if (parsed.championshipId && isValidFaceitId(parsed.championshipId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'championshipId',
        value: parsed.championshipId,
      })
      foundAny = true
    }

    // Set league ID if found and valid
    if (parsed.leagueId && isValidFaceitId(parsed.leagueId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'leagueId',
        value: parsed.leagueId,
      })
      foundAny = true
    }

    // Set season ID if found and valid
    if (parsed.seasonId && isValidFaceitId(parsed.seasonId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'seasonId',
        value: parsed.seasonId,
      })
      foundAny = true
    }

    // Set stage ID if found and valid
    if (parsed.stageId && isValidFaceitId(parsed.stageId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'stageId',
        value: parsed.stageId,
      })
      foundAny = true
    }

    if (foundAny) {
      setSuccess('✅ IDs extracted and filled in! Check the form below.')
      setUrl('')
    } else {
      setError('❌ Could not extract any valid IDs from this URL. Please check the URL format.')
    }
  }

  return (
    <div style={{ 
      padding: '1rem', 
      background: 'rgba(139, 92, 246, 0.1)', 
      borderRadius: '8px',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      marginBottom: '1rem'
    }}>
      <h3 style={{ marginTop: 0, color: 'rgb(165, 180, 252)' }}>
        🔗 Quick Fill from FaceIt URL
      </h3>
      <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '1rem' }}>
        Paste any FaceIt URL (league, championship, standings, or team page) to automatically extract available IDs.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
          placeholder="https://www.faceit.com/en/teams/..."
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'white',
            fontSize: '0.875rem'
          }}
        />
        <button
          type="button"
          onClick={handleParse}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            background: 'rgb(139, 92, 246)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600
          }}
        >
          Extract IDs
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '0.5rem', 
          background: 'rgba(239, 68, 68, 0.2)', 
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: 'rgb(252, 165, 165)'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ 
          padding: '0.5rem', 
          background: 'rgba(34, 197, 94, 0.2)', 
          border: '1px solid rgba(34, 197, 94, 0.4)',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: 'rgb(134, 239, 172)'
        }}>
          {success}
        </div>
      )}

      <details style={{ marginTop: '0.75rem', fontSize: '0.875rem', opacity: 0.7 }}>
        <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
          📋 Supported URL formats
        </summary>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li><strong>League Standings:</strong> /league/[NAME]/[LEAGUE-ID]/[SEASON-ID]/standings?stage=...</li>
          <li><strong>Championship:</strong> URLs containing /championships/[ID]</li>
          <li><strong>Team page:</strong> https://www.faceit.com/en/teams/[ID]</li>
        </ul>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', opacity: 0.6 }}>
          💡 Tip: The standings URL is best! It contains league, season, and stage IDs all in one.
        </p>
      </details>
    </div>
  )
}

export default FaceitUrlHelper

/**
 * Team URL Helper Component
 * 
 * Simplified version that only extracts Team ID for use on the Teams collection
 */
export const TeamUrlHelper: React.FC = () => {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { dispatchFields } = useForm()

  const handleParse = () => {
    setError('')
    setSuccess('')

    if (!url.trim()) {
      setError('Please enter a FaceIt team URL')
      return
    }

    const parsed = parseFaceitUrl(url)

    // Only extract team ID
    if (parsed.teamId && isValidFaceitId(parsed.teamId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'faceitTeamId',
        value: parsed.teamId,
      })
      setSuccess('✅ Team ID extracted and filled in!')
      setUrl('')
    } else {
      setError('❌ Could not extract team ID from this URL. Please use the team\'s FaceIt profile URL.')
    }
  }

  return (
    <div style={{ 
      padding: '1rem', 
      background: 'rgba(139, 92, 246, 0.1)', 
      borderRadius: '8px',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      marginBottom: '1rem'
    }}>
      <h3 style={{ marginTop: 0, color: 'rgb(165, 180, 252)', fontSize: '1rem' }}>
        🔗 Quick Fill Team ID from URL
      </h3>
      <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '1rem' }}>
        Paste the team's FaceIt profile URL to automatically extract the Team ID.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
          placeholder="https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae"
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'white',
            fontSize: '0.875rem'
          }}
        />
        <button
          type="button"
          onClick={handleParse}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            background: 'rgb(139, 92, 246)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600
          }}
        >
          Extract ID
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '0.5rem', 
          background: 'rgba(239, 68, 68, 0.2)', 
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: 'rgb(252, 165, 165)'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ 
          padding: '0.5rem', 
          background: 'rgba(34, 197, 94, 0.2)', 
          border: '1px solid rgba(34, 197, 94, 0.4)',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: 'rgb(134, 239, 172)'
        }}>
          {success}
        </div>
      )}

      <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.8rem', opacity: 0.6 }}>
        💡 Example: <code>https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae</code>
      </p>
    </div>
  )
}

