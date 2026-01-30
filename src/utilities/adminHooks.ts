'use client'

import { useState, useEffect } from 'react'
import { useAdminUser } from './adminAuth'
import { extractPersonId } from './personHelpers'

/**
 * Admin Data Fetching Hooks
 * 
 * Provides reusable hooks for fetching common data in admin components.
 * Reduces duplication across AssignedTeamsDashboard, AssignedTeamsBanner, etc.
 */

/**
 * Team data returned by useAssignedTeams
 */
export interface AssignedTeam {
  id: number
  name: string
  slug?: string
  logo?: string
}

/**
 * Hook to fetch assigned teams for the current user
 * 
 * Used by:
 * - AssignedTeamsDashboard (shows cards on dashboard)
 * - AssignedTeamsBanner (shows banner on Teams list page)
 * 
 * @returns Object with teams array, loading state, and error
 */
export function useAssignedTeams() {
  const user = useAdminUser()
  const [teams, setTeams] = useState<AssignedTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setTeams([])
      setLoading(false)
      return
    }

    const fetchTeams = async () => {
      try {
        const userAssignedTeams = user.assignedTeams
        
        // If no assigned teams, return empty
        if (!userAssignedTeams || !Array.isArray(userAssignedTeams) || userAssignedTeams.length === 0) {
          setTeams([])
          setLoading(false)
          return
        }

        // Extract team IDs
        const teamIds = userAssignedTeams
          .map((team: any) => (typeof team === 'number' ? team : team?.id || team))
          .filter((id): id is number => typeof id === 'number')

        if (teamIds.length === 0) {
          setTeams([])
          setLoading(false)
          return
        }

        // Fetch team details
        const response = await fetch(
          `/api/teams?where[id][in]=${teamIds.join(',')}&limit=${teamIds.length}`,
          { credentials: 'include' }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch assigned teams')
        }

        const data = await response.json()
        const fetchedTeams: AssignedTeam[] = (data.docs || []).map((team: any) => {
          // Extract logo URL from upload relationship (prefer filename for static path)
          let logoUrl = '/logos/org.png'
          if (team.logo) {
            if (typeof team.logo === 'string') {
              logoUrl = team.logo // Legacy string format
            } else if (typeof team.logo === 'object') {
              // Prefer filename-based static path
              if (team.logo.filename) {
                logoUrl = `/graphics-assets/${team.logo.filename}`
              } else if (team.logo.url) {
                logoUrl = team.logo.url
              }
            }
          }
          
          return {
            id: team.id,
            name: team.name || 'Untitled Team',
            slug: team.slug,
            logo: logoUrl,
          }
        })

        setTeams(fetchedTeams)
      } catch (err) {
        console.error('Error fetching assigned teams:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch teams')
        setTeams([])
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [user])

  return { teams, loading, error }
}

/**
 * Person relationships data structure
 */
export interface PersonRelationships {
  teams: Array<{ id: number; name: string; roles: string[] }>
  orgStaff: Array<{ id: number; roles: string[] }>
  production: Array<{ id: number; type: string }>
}

/**
 * Hook to fetch all relationships for a person
 * 
 * Used by:
 * - PersonRelationships component (shows on People edit page)
 * 
 * @param personId - The ID of the person to fetch relationships for
 * @returns Object with relationships, loading state, and error
 */
export function usePersonRelationships(personId: number | string | null | undefined) {
  const [relationships, setRelationships] = useState<PersonRelationships>({
    teams: [],
    orgStaff: [],
    production: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!personId) {
      setRelationships({ teams: [], orgStaff: [], production: [] })
      setLoading(false)
      return
    }

    const fetchRelationships = async () => {
      try {
        const id = typeof personId === 'string' ? parseInt(personId, 10) : personId

        // Fetch all teams and check if this person is in them
        const [teamsResponse, orgStaffResponse, productionResponse] = await Promise.all([
          fetch(`/api/teams?limit=1000`, { credentials: 'include' }),
          fetch(`/api/organization-staff?where[person][equals]=${id}&limit=1000`, { credentials: 'include' }),
          fetch(`/api/production?where[person][equals]=${id}&limit=1000`, { credentials: 'include' }),
        ])

        const teamsData = teamsResponse.ok ? await teamsResponse.json() : { docs: [] }
        const orgStaffData = orgStaffResponse.ok ? await orgStaffResponse.json() : { docs: [] }
        const productionData = productionResponse.ok ? await productionResponse.json() : { docs: [] }

        // Process teams
        const personTeams: Array<{ id: number; name: string; roles: string[] }> = []
        
        teamsData.docs.forEach((team: any) => {
          const roles: string[] = []

          // Check all team positions
          if (team.manager?.some((m: any) => extractPersonId(m) === id)) roles.push('Manager')
          if (team.coaches?.some((c: any) => extractPersonId(c) === id)) roles.push('Coach')
          if (team.captain?.some((cap: any) => extractPersonId(cap) === id)) roles.push('Captain')
          if (team.players?.some((p: any) => extractPersonId(p) === id)) roles.push('Player')
          if (team.substitutes?.some((s: any) => extractPersonId(s) === id)) roles.push('Substitute')

          if (roles.length > 0) {
            personTeams.push({
              id: team.id,
              name: team.name || 'Untitled Team',
              roles,
            })
          }
        })

        // Process org staff
        const orgStaff = orgStaffData.docs.map((staff: any) => ({
          id: staff.id,
          roles: staff.roles || [],
        }))

        // Process production
        const production = productionData.docs.map((prod: any) => ({
          id: prod.id,
          type: prod.type || 'Unknown',
        }))

        setRelationships({
          teams: personTeams,
          orgStaff,
          production,
        })
      } catch (err) {
        console.error('Error fetching person relationships:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch relationships')
      } finally {
        setLoading(false)
      }
    }

    fetchRelationships()
  }, [personId])

  return { relationships, loading, error }
}

/**
 * Hook to fetch quick stats for the admin dashboard
 * 
 * Used by:
 * - QuickStats component
 * 
 * @returns Object with stats, loading state, and error
 */
export interface DashboardStats {
  teams: number
  people: number
  matches: number
  orgStaff: number
  production: number
  upcomingMatches: number
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all stats in parallel
        const [teamsRes, peopleRes, matchesRes, orgStaffRes, productionRes] = await Promise.all([
          fetch('/api/teams?limit=1', { credentials: 'include' }),
          fetch('/api/people?limit=1', { credentials: 'include' }),
          fetch('/api/matches?limit=1', { credentials: 'include' }),
          fetch('/api/organization-staff?limit=1', { credentials: 'include' }),
          fetch('/api/production?limit=1', { credentials: 'include' }),
        ])

        const teamsData = teamsRes.ok ? await teamsRes.json() : { totalDocs: 0 }
        const peopleData = peopleRes.ok ? await peopleRes.json() : { totalDocs: 0 }
        const matchesData = matchesRes.ok ? await matchesRes.json() : { totalDocs: 0 }
        const orgStaffData = orgStaffRes.ok ? await orgStaffRes.json() : { totalDocs: 0 }
        const productionData = productionRes.ok ? await productionRes.json() : { totalDocs: 0 }

        // Get upcoming matches count
        let upcomingMatches = 0
        if (matchesRes.ok) {
          const now = new Date().toISOString()
          const upcomingRes = await fetch(
            `/api/matches?where[date][greater_than]=${now}&limit=1`,
            { credentials: 'include' }
          )
          if (upcomingRes.ok) {
            const upcomingData = await upcomingRes.json()
            upcomingMatches = upcomingData.totalDocs || 0
          }
        }

        setStats({
          teams: teamsData.totalDocs || 0,
          people: peopleData.totalDocs || 0,
          matches: matchesData.totalDocs || 0,
          orgStaff: orgStaffData.totalDocs || 0,
          production: productionData.totalDocs || 0,
          upcomingMatches,
        })
      } catch (err) {
        console.error('Error fetching dashboard stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading, error }
}

