'use client'

/**
 * Shared data cache for People list columns
 * 
 * Instead of each cell fetching data independently,
 * we fetch once and cache it in memory.
 * 
 * Performance: Reduces API calls from 60+ per page to just 3 total
 */

interface CachedData {
  teams: any[]
  orgStaff: any[]
  production: any[]
  timestamp: number
}

// Cache duration: 30 seconds
const CACHE_DURATION = 30 * 1000

let cache: CachedData | null = null
let fetchPromise: Promise<CachedData> | null = null

/**
 * Fetches all data needed for People list columns
 * Uses in-memory caching to prevent redundant API calls
 */
export async function getPeopleListData(): Promise<CachedData> {
  const now = Date.now()

  // Return cached data if still valid
  if (cache && now - cache.timestamp < CACHE_DURATION) {
    return cache
  }

  // If already fetching, return the existing promise
  if (fetchPromise) {
    return fetchPromise
  }

  // Fetch fresh data
  fetchPromise = (async () => {
    try {
      // Fetch all data in parallel - ONLY 3 API CALLS!
      const [teamsRes, orgStaffRes, productionRes] = await Promise.all([
        fetch('/api/teams?limit=1000&depth=0', { credentials: 'include' }),
        fetch('/api/organization-staff?limit=1000&depth=0', { credentials: 'include' }),
        fetch('/api/production?limit=1000&depth=0', { credentials: 'include' }),
      ])

      const [teamsData, orgStaffData, productionData] = await Promise.all([
        teamsRes.ok ? teamsRes.json() : { docs: [] },
        orgStaffRes.ok ? orgStaffRes.json() : { docs: [] },
        productionRes.ok ? productionRes.json() : { docs: [] },
      ])

      const data: CachedData = {
        teams: teamsData.docs || [],
        orgStaff: orgStaffData.docs || [],
        production: productionData.docs || [],
        timestamp: Date.now(),
      }

      cache = data
      return data
    } catch (error) {
      console.error('[PeopleListDataCache] Error fetching data:', error)
      return {
        teams: [],
        orgStaff: [],
        production: [],
        timestamp: Date.now(),
      }
    } finally {
      fetchPromise = null
    }
  })()

  return fetchPromise
}

/**
 * Clear the cache (useful for testing or after mutations)
 */
export function clearPeopleListCache() {
  cache = null
  fetchPromise = null
}

