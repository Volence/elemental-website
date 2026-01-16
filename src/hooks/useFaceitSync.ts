'use client'

import { useState, useEffect, useCallback } from 'react'

interface LeagueData {
  id: number
  name: string
  championshipId: string
  leagueId: string
  seasonId: string
  stageId?: string
}

interface SyncResult {
  success: boolean
  matchesUpdated?: number
  matchesCreated?: number
  error?: string
}

interface UseFaceitSyncOptions {
  teamId: number | string | undefined
  faceitTeamId: string | undefined
  leagueId: number | string | undefined
}

interface UseFaceitSyncReturn {
  // State
  syncing: boolean
  message: string
  error: boolean
  leagueData: LeagueData | null
  lastSynced: string | null
  
  // Actions
  sync: () => Promise<void>
  clearMessage: () => void
}

/**
 * Custom hook for FACEIT sync functionality
 * Extracts common logic from FaceitSyncButton for reuse
 */
export function useFaceitSync({
  teamId,
  faceitTeamId,
  leagueId,
}: UseFaceitSyncOptions): UseFaceitSyncReturn {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null)
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  // Fetch league data when leagueId changes
  useEffect(() => {
    if (!leagueId) {
      setLeagueData(null)
      return
    }

    const fetchLeagueData = async () => {
      try {
        const res = await fetch(`/api/faceit-leagues/${leagueId}`)
        if (!res.ok) throw new Error(`Failed to fetch league: ${res.status}`)
        const data = await res.json()
        setLeagueData(data)
      } catch (err: any) {
        setMessage(`Error loading league data: ${err.message}`)
        setError(true)
      }
    }

    fetchLeagueData()
  }, [leagueId])

  // Fetch last synced time
  useEffect(() => {
    if (!teamId) return

    const fetchLastSynced = async () => {
      try {
        const response = await fetch(
          `/api/faceit-seasons?where[team][equals]=${teamId}&where[isActive][equals]=true&limit=1`
        )
        const data = await response.json()

        if (data.docs?.[0]?.lastSynced) {
          setLastSynced(data.docs[0].lastSynced)
        }
      } catch (err) {
        // Silent fail - last synced is not critical
      }
    }

    fetchLastSynced()
  }, [teamId])

  // Sync function
  const sync = useCallback(async () => {
    // Validation
    const missing: string[] = []
    if (!teamId) missing.push('Team must be saved first')
    if (!faceitTeamId) missing.push('FaceIt Team ID is required')
    if (!leagueData) missing.push('League data not loaded')

    if (missing.length > 0) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceitTeamId,
          championshipId: leagueData!.championshipId,
          leagueId: leagueData!.leagueId,
          seasonId: leagueData!.seasonId,
          stageId: leagueData!.stageId,
        }),
      })

      const result: SyncResult = await response.json()

      if (result.success) {
        setMessage(
          `✓ Sync successful! Updated ${result.matchesUpdated || 0} matches, created ${result.matchesCreated || 0} new matches.`
        )
        setError(false)
        setLastSynced(new Date().toISOString())
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
  }, [teamId, faceitTeamId, leagueData])

  const clearMessage = useCallback(() => {
    setMessage('')
    setError(false)
  }, [])

  return {
    syncing,
    message,
    error,
    leagueData,
    lastSynced,
    sync,
    clearMessage,
  }
}
