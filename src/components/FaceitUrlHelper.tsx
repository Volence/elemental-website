'use client'

import React, { useState } from 'react'
import { useForm } from '@payloadcms/ui'
import { parseFaceitUrl, isValidFaceitId } from '@/utilities/faceitUrlParser'

/**
 * FaceIt URL Helper Component
 * 
 * Makes it easy to fill in FaceIt season data by pasting URLs instead of manually entering IDs.
 * Auto-fetches the Championship ID from the FACEIT API after extracting other IDs.
 */
const FaceitUrlHelper: React.FC = () => {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [championshipStatus, setChampionshipStatus] = useState('')
  const { dispatchFields } = useForm()

  /**
   * Attempt to auto-fetch the Championship ID from FACEIT via our server-side proxy.
   */
  const lookupChampionshipId = async (seasonId: string, stageId?: string, conferenceId?: string) => {
    setChampionshipStatus('🔍 Looking up Championship ID...')

    try {
      const params = new URLSearchParams({ seasonId })
      if (stageId) params.set('stageId', stageId)
      if (conferenceId) params.set('conferenceId', conferenceId)

      const response = await fetch(`/api/faceit/lookup-championship?${params}`)
      const data = await response.json()

      if (response.ok && data.championshipId && dispatchFields) {
        dispatchFields({
          type: 'UPDATE',
          path: 'championshipId',
          value: data.championshipId,
        })
        const details = [data.regionName, data.divisionName, data.conferenceName].filter(Boolean).join(' → ')
        setChampionshipStatus(`✅ Championship ID found and filled in! (${details || 'auto-detected'})`)
        return true
      }
    } catch (err) {
      console.error('[FaceitUrlHelper] Championship lookup failed:', err)
    }

    // Lookup failed — show fallback instructions
    setChampionshipStatus('')
    setError(prev => {
      const fallback = '⚠️ Could not auto-detect Championship ID. To find it manually:\n' +
        '1. Open the FACEIT standings page in your browser\n' +
        '2. Open DevTools → Network tab (F12)\n' +
        '3. Look for a request to "seasons/tree" in the API calls\n' +
        '4. In the response JSON, find "championship_id" under your stage/conference\n' +
        '5. Copy the UUID and paste it into the Championship ID field below'
      return prev ? `${prev}\n\n${fallback}` : fallback
    })
    return false
  }

  const handleParse = async () => {
    setError('')
    setSuccess('')
    setChampionshipStatus('')

    if (!url.trim()) {
      setError('Please enter a FaceIt URL')
      return
    }

    const parsed = parseFaceitUrl(url)
    let foundAny = false
    let extractedSeasonId: string | null = null
    let extractedStageId: string | null = null
    let extractedConferenceId: string | null = null
    let alreadyHasChampionship = false

    // Set championship ID if found directly in the URL
    if (parsed.championshipId && isValidFaceitId(parsed.championshipId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'championshipId',
        value: parsed.championshipId,
      })
      foundAny = true
      alreadyHasChampionship = true
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
      extractedSeasonId = parsed.seasonId
    }

    // Set stage ID if found and valid
    if (parsed.stageId && isValidFaceitId(parsed.stageId) && dispatchFields) {
      dispatchFields({
        type: 'UPDATE',
        path: 'stageId',
        value: parsed.stageId,
      })
      foundAny = true
      extractedStageId = parsed.stageId
    }

    // Track conference ID for championship lookup (not a form field, just used for API lookup)
    if (parsed.conferenceId && isValidFaceitId(parsed.conferenceId)) {
      extractedConferenceId = parsed.conferenceId
    }

    if (foundAny) {
      setSuccess('✅ IDs extracted and filled in! Check the form below.')
      setUrl('')

      // If we got a Season ID but no Championship ID from the URL, try to auto-fetch it
      if (extractedSeasonId && !alreadyHasChampionship) {
        await lookupChampionshipId(extractedSeasonId, extractedStageId || undefined, extractedConferenceId || undefined)
      }
    } else {
      setError('❌ Could not extract any valid IDs from this URL. Please check the URL format.')
    }
  }

  return (
    <div className="faceit-url-helper">
      <h3 className="faceit-url-helper__title">
        🔗 Quick Fill from FaceIt URL
      </h3>
      <p className="faceit-url-helper__description">
        Paste any FaceIt URL (league, championship, standings, or team page) to automatically extract available IDs.
      </p>

      <div className="faceit-url-helper__input-group">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
          placeholder="https://www.faceit.com/en/teams/..."
          className="faceit-url-helper__input"
        />
        <button
          type="button"
          onClick={handleParse}
          className="faceit-url-helper__button"
        >
          Extract IDs
        </button>
      </div>

      {championshipStatus && (
        <div className="faceit-url-helper__message faceit-url-helper__message--info">
          {championshipStatus}
        </div>
      )}

      {error && (
        <div className="faceit-url-helper__message faceit-url-helper__message--error" style={{ whiteSpace: 'pre-line' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="faceit-url-helper__message faceit-url-helper__message--success">
          {success}
        </div>
      )}

      <details className="faceit-url-helper__formats">
        <summary>
          📋 Supported URL formats
        </summary>
        <ul>
          <li><strong>League Standings:</strong> /league/[NAME]/[LEAGUE-ID]/[SEASON-ID]/standings?stage=...</li>
          <li><strong>Championship:</strong> URLs containing /championships/[ID]</li>
          <li><strong>Team page:</strong> https://www.faceit.com/en/teams/[ID]</li>
        </ul>
        <p className="faceit-url-helper__formats-tip">
          💡 Tip: The standings URL is best! It contains league, season, and stage IDs all in one.
          The Championship ID will be auto-detected when possible.
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
    <div className="faceit-url-helper">
      <h3 className="faceit-url-helper__title">
        🔗 Quick Fill Team ID from URL
      </h3>
      <p className="faceit-url-helper__description">
        Paste the team's FaceIt profile URL to automatically extract the Team ID.
      </p>

      <div className="faceit-url-helper__input-group">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
          placeholder="https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae"
          className="faceit-url-helper__input"
        />
        <button
          type="button"
          onClick={handleParse}
          className="faceit-url-helper__button"
        >
          Extract ID
        </button>
      </div>

      {error && (
        <div className="faceit-url-helper__message faceit-url-helper__message--error">
          {error}
        </div>
      )}

      {success && (
        <div className="faceit-url-helper__message faceit-url-helper__message--success">
          {success}
        </div>
      )}

      <p className="faceit-url-helper__example">
        💡 Example: <code>https://www.faceit.com/en/teams/bc03efbc-725a-42f2-8acb-c8ee9783c8ae</code>
      </p>
    </div>
  )
}

