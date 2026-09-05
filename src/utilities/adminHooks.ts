'use client'

import { useState, useEffect } from 'react'
import { extractPersonId } from './personHelpers'
import { isTitleValue, titleLabel, TITLE_BY_VALUE, type TitleValue } from '@/access/titles'

/**
 * Admin Data Fetching Hooks
 *
 * Provides reusable hooks for fetching common data in admin components.
 */

/**
 * Person relationships data structure. `orgStaff` and `production` used to come from the
 * now-retired organization-staff/production collections; they read `person.titles` instead,
 * one synthesized entry per title in that group (see titles.ts for the group taxonomy).
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

        const [teamsResponse, personResponse] = await Promise.all([
          fetch(`/api/teams?limit=1000`, { credentials: 'include' }),
          fetch(`/api/people/${id}?depth=0`, { credentials: 'include' }),
        ])

        const teamsData = teamsResponse.ok ? await teamsResponse.json() : { docs: [] }
        const person = personResponse.ok ? await personResponse.json() : null

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

        // Titles in the 'organization' or 'department' groups read as org staff, one
        // synthesized row per title (no separate collection id any more, so index-based).
        const titles = ((person?.titles ?? []) as Array<{ title?: string | null; isLead?: boolean | null }>)
          .filter((t): t is { title: TitleValue; isLead?: boolean | null } => isTitleValue(t.title))
        const orgStaff = titles
          .filter((t) => TITLE_BY_VALUE[t.title].group === 'organization' || TITLE_BY_VALUE[t.title].group === 'department')
          .map((t, i) => ({ id: i, roles: [titleLabel({ title: t.title, isLead: t.isLead })] }))
        const production = titles
          .filter((t) => TITLE_BY_VALUE[t.title].group === 'production')
          .map((t, i) => ({ id: i, type: titleLabel({ title: t.title, isLead: t.isLead }) }))

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
  /** People with at least one title (replaces the old organization-staff + production counts). */
  peopleWithTitles: number
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
        const [teamsRes, peopleRes, matchesRes, titledRes] = await Promise.all([
          fetch('/api/teams?limit=1', { credentials: 'include' }),
          fetch('/api/people?limit=1', { credentials: 'include' }),
          fetch('/api/matches?limit=1', { credentials: 'include' }),
          fetch('/api/people?where[titles.title][exists]=true&limit=1', { credentials: 'include' }),
        ])

        const teamsData = teamsRes.ok ? await teamsRes.json() : { totalDocs: 0 }
        const peopleData = peopleRes.ok ? await peopleRes.json() : { totalDocs: 0 }
        const matchesData = matchesRes.ok ? await matchesRes.json() : { totalDocs: 0 }
        const titledData = titledRes.ok ? await titledRes.json() : { totalDocs: 0 }

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
          peopleWithTitles: titledData.totalDocs || 0,
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

