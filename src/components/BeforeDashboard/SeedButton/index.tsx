'use client'

import React, { Fragment, useCallback, useState } from 'react'
import { toast } from '@payloadcms/ui'

import './index.scss'

const SuccessMessage: React.FC<{ teamsOnly?: boolean }> = ({ teamsOnly }) => (
  <div>
    {teamsOnly ? 'Teams seeded successfully! ' : 'Database seeded! '}
    You can now{' '}
    <a target="_blank" href="/">
      visit your website
    </a>
  </div>
)

export const SeedButton: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [teamsSeeded, setTeamsSeeded] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const handleSeed = useCallback(
    async (endpoint: string, teamsOnly: boolean = false) => {
      const setLoadingState = teamsOnly ? setLoadingTeams : setLoading
      const setSeededState = teamsOnly ? setTeamsSeeded : setSeeded

      if (loading || loadingTeams) {
        toast.info('Seeding already in progress.')
        return
      }
      if (error) {
        toast.error(`An error occurred, please refresh and try again.`)
        return
      }

      setLoadingState(true)
      setError(null)

      try {
        toast.promise(
          new Promise((resolve, reject) => {
            try {
              fetch(endpoint, { method: 'POST', credentials: 'include' })
                .then(async (res) => {
                  if (res.ok) {
                    const data = await res.json()
                    resolve(data)
                    setSeededState(true)
                  } else {
                    const text = await res.text()
                    reject(text || 'An error occurred while seeding.')
                  }
                })
                .catch((error) => {
                  reject(error.message || 'Network error occurred.')
                })
            } catch (error) {
              reject(error instanceof Error ? error.message : 'Unknown error')
            }
          }),
          {
            loading: teamsOnly ? 'Clearing teams and seeding fresh data...' : 'Seeding with data....',
            success: <SuccessMessage teamsOnly={teamsOnly} />,
            error: 'An error occurred while seeding.',
          },
        )
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        setError(error)
        toast.error(error)
      } finally {
        setLoadingState(false)
      }
    },
    [loading, loadingTeams, error],
  )

  const handleFullSeed = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      handleSeed('/next/seed', false)
    },
    [handleSeed],
  )

  const handleTeamsSeed = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      handleSeed('/next/seed-teams', true)
    },
    [handleSeed],
  )

  return (
    <Fragment>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button 
          className="seedButton" 
          onClick={handleTeamsSeed}
          disabled={loading || loadingTeams}
          style={{ opacity: (loading || loadingTeams) ? 0.6 : 1 }}
        >
          {loadingTeams ? 'Seeding Teams...' : 'Seed Teams Only'}
        </button>
        <button 
          className="seedButton" 
          onClick={handleFullSeed}
          disabled={loading || loadingTeams}
          style={{ opacity: (loading || loadingTeams) ? 0.6 : 1 }}
        >
          {loading ? 'Seeding...' : 'Seed Full Database'}
        </button>
      </div>
      {(seeded || teamsSeeded) && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#28a745' }}>
          ✓ {teamsSeeded ? 'Teams seeded' : ''} {seeded ? 'Full database seeded' : ''}
        </div>
      )}
      {error && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#dc3545' }}>
          ✗ Error: {error}
        </div>
      )}
    </Fragment>
  )
}
