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

