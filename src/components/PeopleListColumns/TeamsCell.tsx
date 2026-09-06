'use client'

import React, { useEffect, useState } from 'react'
import { AdminBadgeGroupSkeleton } from '@/components/AdminSkeletonLoader'

// Cache duration: 30 seconds. Every row's cell asks for the same teams list, so a single
// in-memory cache (rather than the old shared multi-collection peopleListDataCache, retired
// with the organization-staff/production collections it also cached) keeps this to one fetch
// per page instead of one per row.
const CACHE_DURATION = 30 * 1000
let teamsCache: { teams: any[]; timestamp: number } | null = null
let teamsFetchPromise: Promise<any[]> | null = null

async function getAllTeamsForList(): Promise<any[]> {
  const now = Date.now()
  if (teamsCache && now - teamsCache.timestamp < CACHE_DURATION) return teamsCache.teams
  if (teamsFetchPromise) return teamsFetchPromise

  teamsFetchPromise = (async () => {
    try {
      const res = await fetch('/api/teams?limit=1000&depth=0', { credentials: 'include' })
      const data = res.ok ? await res.json() : { docs: [] }
      const teams = data.docs || []
      teamsCache = { teams, timestamp: Date.now() }
      return teams
    } catch (error) {
      console.error('[TeamsCell] Error fetching teams:', error)
      return []
    } finally {
      teamsFetchPromise = null
    }
  })()

  return teamsFetchPromise
}

/**
 * Custom cell component that displays all teams a person is associated with
 * Shows in the People list view
 */
const TeamsCell: React.FC<{ rowData: any }> = ({ rowData }) => {
  const [teams, setTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const findPersonTeams = async () => {
      if (!rowData?.id) {
        setLoading(false)
        return
      }

      try {
        const allTeams = await getAllTeamsForList()
        const personId = Number(rowData.id)
        const associatedTeams: string[] = []

        // Check each team for this person
        allTeams.forEach((team: any) => {
          let isInTeam = false

          // Check manager
          if (team.manager?.some((m: any) => {
            const pid = typeof m.person === 'number' ? m.person : m.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check coaches
          if (team.coaches?.some((c: any) => {
            const pid = typeof c.person === 'number' ? c.person : c.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check captain
          if (team.captain?.some((cap: any) => {
            const pid = typeof cap.person === 'number' ? cap.person : cap.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check roster
          if (team.roster?.some((r: any) => {
            const pid = typeof r.person === 'number' ? r.person : r.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          // Check subs
          if (team.subs?.some((s: any) => {
            const pid = typeof s.person === 'number' ? s.person : s.person?.id
            return pid === personId
          })) {
            isInTeam = true
          }

          if (isInTeam && team.name) {
            associatedTeams.push(team.name)
          }
        })

        setTeams(associatedTeams)
      } catch (error) {
        console.error('[TeamsCell] Error finding teams:', error)
      } finally {
        setLoading(false)
      }
    }

    findPersonTeams()
  }, [rowData?.id])

  if (loading) {
    return <AdminBadgeGroupSkeleton count={1} />
  }

  if (teams.length === 0) {
    return <span className="list-cell-empty">-</span>
  }

  return (
    <div className="list-cell-tags">
      {teams.map((team, idx) => (
        <span key={idx} className="list-cell-tag list-cell-tag--team">
          {team}
        </span>
      ))}
    </div>
  )
}

export default TeamsCell
