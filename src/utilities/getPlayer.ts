import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAllTeams } from './getTeams'
import { isPopulatedPerson, getPersonIdFromRelationship, getSocialLinksFromPerson, getPhotoIdFromPerson, getPhotoUrlFromPerson } from './personHelpers'

export const formatPlayerSlug = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const formatSlug = formatPlayerSlug

export interface PlayerTeamInfo {
  teamSlug: string
  teamName: string
  teamLogo: string
  role?: 'tank' | 'dps' | 'support'
  positions?: ('player' | 'sub' | 'captain' | 'co-captain' | 'manager' | 'coach')[]
}

export interface PlayerInfo {
  name: string
  slug: string
  bio?: string
  photo?: number | null
  photoUrl?: string | null
  teams: PlayerTeamInfo[]
  staffRoles: {
    organization?: string[]
    production?: string
  }
  socialLinks: {
    twitter?: string
    twitch?: string
    youtube?: string
    instagram?: string
  }
}

/**
 * Get player information by name
 */
export async function getPlayerByName(name: string): Promise<PlayerInfo | null> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return null
  }

  try {
    const allTeams = await getAllTeams()
    const payload = await getPayload({ config: configPromise })
  
  const slug = formatSlug(name)
  const teams: PlayerTeamInfo[] = []
  const staffRoles: PlayerInfo['staffRoles'] = {
    organization: [],
    production: undefined,
  }
  
  // Merge social links from all sources
  const socialLinks: PlayerInfo['socialLinks'] = {}
  
  // Helper function to get or create team entry and add position
  const getOrCreateTeam = (teamSlug: string, teamName: string, teamLogo: string) => {
    let teamEntry = teams.find((t) => t.teamSlug === teamSlug)
    if (!teamEntry) {
      teamEntry = {
        teamSlug,
        teamName,
        teamLogo,
        positions: [],
      }
      teams.push(teamEntry)
    }
    return teamEntry
  }

  // Helper function to add position to a team entry
  const addPosition = (teamEntry: PlayerTeamInfo, position: 'player' | 'sub' | 'captain' | 'co-captain' | 'manager' | 'coach') => {
    if (!teamEntry.positions) {
      teamEntry.positions = []
    }
    if (!teamEntry.positions.includes(position)) {
      teamEntry.positions.push(position)
    }
  }

  // Helper to check if a team entry matches the name
  // Note: allTeams is already transformed, so entries have 'name' property directly
  const matchesTeamEntryName = (entry: any, searchName: string): boolean => {
    // Transformed team data has 'name' property directly (from extractPersonData)
    if (entry.name && typeof entry.name === 'string') {
      return entry.name.toLowerCase() === searchName.toLowerCase()
    }
    return false
  }

  // Check all teams for this player
  allTeams.forEach((team) => {
    // Check roster
    const rosterPlayer = team.roster?.find((p) => matchesTeamEntryName(p, name))
    if (rosterPlayer) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      teamEntry.role = rosterPlayer.role
      addPosition(teamEntry, 'player')
      Object.assign(socialLinks, rosterPlayer)
    }
    
    // Check subs
    const subPlayer = team.subs?.find((s) => matchesTeamEntryName(s, name))
    if (subPlayer) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      addPosition(teamEntry, 'sub')
      Object.assign(socialLinks, subPlayer)
    }
    
    // Check captain
    const captain = team.captain?.find((c) => matchesTeamEntryName(c, name))
    if (captain) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      addPosition(teamEntry, 'captain')
      Object.assign(socialLinks, captain)
    }
    
    // Check co-captain (transformed data has coCaptain as string name or null)
    if (team.coCaptain && typeof team.coCaptain === 'string') {
      if (team.coCaptain.toLowerCase() === name.toLowerCase()) {
        const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
        addPosition(teamEntry, 'co-captain')
      }
    }
    
    // Check manager
    const manager = team.manager?.find((m) => matchesTeamEntryName(m, name))
    if (manager) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      addPosition(teamEntry, 'manager')
      Object.assign(socialLinks, manager)
    }
    
    // Check coaches
    const coach = team.coaches?.find((c) => matchesTeamEntryName(c, name))
    if (coach) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      addPosition(teamEntry, 'coach')
      Object.assign(socialLinks, coach)
    }
  })
  
  // Helper to normalize names for comparison
  const normalizeName = (name: string): string => {
    return name.trim().toLowerCase()
  }

  // Helper to get person name from entry (handles both populated and unpopulated relationships)
  const getPersonName = async (entry: any): Promise<string | null> => {
    if (!entry.person) {
      return null
    }
    
    // Handle populated person object with name
    if (isPopulatedPerson(entry.person)) {
      return entry.person.name
    }
    
    // Handle case where person is just an ID - fetch it manually
    const personId = getPersonIdFromRelationship(entry.person)
    
    if (personId) {
      try {
        const person = await payload.findByID({
          collection: 'people',
          id: personId,
          depth: 0,
        })
        return person?.name || null
      } catch (error) {
        // Silently fail - person may not exist or database unavailable
        return null
      }
    }
    
    return null
  }

  // Helper to check if a staff entry matches the name (uses People relationship)
  const matchesName = async (entry: any, searchName: string): Promise<boolean> => {
    const normalizedSearch = normalizeName(searchName)
    
    // Get person name (handles both populated and unpopulated)
    const personName = await getPersonName(entry)
    if (personName) {
      return normalizeName(personName) === normalizedSearch
    }
    
    // Fallback 1: If person is null but entry has a slug, try to find the person by slug
    if (!entry.person && entry.slug) {
      try {
        const peopleResult = await payload.find({
          collection: 'people',
          where: {
            slug: {
              equals: entry.slug,
            },
          },
          limit: 1,
          depth: 0,
        })
        if (peopleResult.docs.length > 0) {
          const foundPerson = peopleResult.docs[0]
          if (foundPerson.name && normalizeName(foundPerson.name) === normalizedSearch) {
            return true
          }
        }
      } catch (error) {
        // Silently fail - person may not exist or database unavailable
      }
    }
    
    // Fallback 2: Match search name directly to entry slug (if slug matches the name)
    if (entry.slug && typeof entry.slug === 'string') {
      const normalizedSlug = normalizeName(entry.slug)
      if (normalizedSlug === normalizedSearch) {
        return true
      }
    }
    
    // Fallback 3: check if entry has a direct name field (legacy support)
    if (entry.name && typeof entry.name === 'string') {
      return normalizeName(entry.name) === normalizedSearch
    }
    
    return false
  }

  // Check organization staff (case-insensitive, supports both People relationship and legacy name)
  const orgStaffResult = await payload.find({
    collection: 'organization-staff',
    limit: 1000,
    pagination: false,
    depth: 1, // Populate person relationship
  })
  
  // Use Promise.all to check all staff entries in parallel
  const orgStaffMatches = await Promise.all(
    orgStaffResult.docs.map(async (staff) => ({
      staff,
      matches: await matchesName(staff, name),
    }))
  )
  const orgStaffMatch = orgStaffMatches.find((m) => m.matches)?.staff
  
  if (orgStaffMatch) {
    const roles = Array.isArray(orgStaffMatch.roles) ? orgStaffMatch.roles : []
    staffRoles.organization = roles
    
    // Social links are now only in the People collection
    const personSocialLinks = getSocialLinksFromPerson(orgStaffMatch.person)
    Object.assign(socialLinks, personSocialLinks)
  }
  
  // Check production staff (case-insensitive, supports both People relationship and legacy name)
  const productionResult = await payload.find({
    collection: 'production',
    limit: 1000,
    pagination: false,
    depth: 1, // Populate person relationship
  })
  
  // Only log if there are production staff entries with null person relationships (data issue)
  const staffWithNullPerson = productionResult.docs.filter((staff) => !staff.person)
  if (staffWithNullPerson.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn(`[getPlayer] Warning: Found ${staffWithNullPerson.length} production staff entries without person relationships. Run "Fix Staff Relationships" to link them.`)
  }
  
  // Use Promise.all to check all staff entries in parallel
  const productionMatches = await Promise.all(
    productionResult.docs.map(async (staff) => ({
      staff,
      matches: await matchesName(staff, name),
    }))
  )
  const productionMatch = productionMatches.find((m) => m.matches)?.staff
  
  if (productionMatch) {
    staffRoles.production = productionMatch.type
    
    // Social links are now only in the People collection
    const personSocialLinks = getSocialLinksFromPerson(productionMatch.person)
    Object.assign(socialLinks, personSocialLinks)
  }
  
  // Fetch person's bio and photo from People collection
  let bio: string | undefined = undefined
  let photo: number | null | undefined = undefined
  let photoUrl: string | null = null
  
  try {
    // Try to find person by slug first (most reliable)
    const personBySlug = await payload.find({
      collection: 'people',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      depth: 1, // Populate photo relationship
    })
    
    if (personBySlug.docs.length > 0) {
      const person = personBySlug.docs[0]
      if (isPopulatedPerson(person)) {
        bio = person.bio || undefined
        photo = getPhotoIdFromPerson(person)
        photoUrl = getPhotoUrlFromPerson(person)
      }
    } else {
      // Fallback: try to find by name (case-insensitive)
      const personByName = await payload.find({
        collection: 'people',
        where: {
          name: {
            equals: name,
          },
        },
        limit: 1,
        depth: 1, // Populate photo relationship
      })
      
      if (personByName.docs.length > 0) {
        const person = personByName.docs[0]
        if (isPopulatedPerson(person)) {
          bio = person.bio || undefined
          photo = getPhotoIdFromPerson(person)
          photoUrl = getPhotoUrlFromPerson(person)
        }
      }
    }
  } catch (error) {
    // Silently fail - person may not exist or database unavailable
  }
  
    // Return player info even if they only have staff roles (no teams)
    // This ensures all staff members can have player pages
    return {
      name,
      slug,
      bio,
      photo,
      photoUrl,
      teams,
      staffRoles,
      socialLinks,
    }
  } catch (_error) {
    // During build, database may not be available
    return null
  }
}

/**
 * Get all unique player names from all teams, organization staff, production staff, and People collection
 */
export async function getAllPlayerNames(): Promise<string[]> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return []
  }

  try {
    const allTeams = await getAllTeams()
    const payload = await getPayload({ config: configPromise })
    const playerNames = new Set<string>()
    
    // Add names from teams (already transformed, so names are extracted)
    allTeams.forEach((team) => {
      team.roster?.forEach((p) => playerNames.add(p.name))
      team.subs?.forEach((s) => playerNames.add(s.name))
      team.captain?.forEach((c) => playerNames.add(c.name))
      if (team.coCaptain) {
        const coCaptain = team.coCaptain as any
        if (typeof coCaptain === 'object' && coCaptain !== null && 'name' in coCaptain) {
          playerNames.add(coCaptain.name)
        } else if (typeof coCaptain === 'string') {
          playerNames.add(coCaptain)
        }
      }
      team.manager?.forEach((m) => playerNames.add(m.name))
      team.coaches?.forEach((c) => playerNames.add(c.name))
    })
    
    // Add names from organization staff (supports both People relationship and legacy name)
    const orgStaffResult = await payload.find({
      collection: 'organization-staff',
      limit: 1000,
      pagination: false,
      depth: 1, // Populate person relationship
    })
    orgStaffResult.docs.forEach((staff) => {
      const personName = isPopulatedPerson(staff.person) ? staff.person.name : null
      // Name is now only in the person relationship (removed from OrganizationStaff)
      if (personName) playerNames.add(personName)
    })
    
    // Add names from production staff (supports both People relationship and legacy name)
    const productionResult = await payload.find({
      collection: 'production',
      limit: 1000,
      pagination: false,
      depth: 1, // Populate person relationship
    })
    productionResult.docs.forEach((staff) => {
      const personName = isPopulatedPerson(staff.person) ? staff.person.name : null
      // Name is now only in the person relationship
      if (personName) playerNames.add(personName)
    })
    
    // Add names from People collection (for any people not yet linked)
    const peopleResult = await payload.find({
      collection: 'people',
      limit: 1000,
      pagination: false,
      depth: 0,
    })
    peopleResult.docs.forEach((person) => {
      if (person.name) playerNames.add(person.name)
    })
    
    return Array.from(playerNames).sort()
  } catch (error) {
    // During Docker build, database may not be available
    // Return empty array - pages will be generated on-demand
    console.warn('Could not get all player names (database not available during build):', error)
    return []
  }
}
