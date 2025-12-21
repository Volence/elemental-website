'use client'

import React, { Fragment, useCallback, useState } from 'react'
import { toast } from '@payloadcms/ui'

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
      <div className="flex gap-3 flex-wrap items-center">
        <button 
          className="appearance-none bg-transparent border-none p-0 underline cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed" 
          onClick={handleTeamsSeed}
          disabled={loading || loadingTeams}
        >
          {loadingTeams ? 'Seeding Teams...' : 'Seed Teams Only'}
        </button>
        <button 
          className="appearance-none bg-transparent border-none p-0 underline cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed" 
          onClick={handleFullSeed}
          disabled={loading || loadingTeams}
        >
          {loading ? 'Seeding...' : 'Seed Full Database'}
        </button>
      </div>
      {(seeded || teamsSeeded) && (
        <div className="mt-2 text-sm text-green-600 dark:text-green-400">
          ✓ {teamsSeeded ? 'Teams seeded' : ''} {seeded ? 'Full database seeded' : ''}
        </div>
      )}
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          ✗ Error: {error}
        </div>
      )}
    </Fragment>
  )
}
