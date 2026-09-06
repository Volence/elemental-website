import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAllTeams } from './getTeams'
import { isPopulatedPerson, getSocialLinksFromPerson, getPhotoIdFromPerson, getPhotoUrlFromPerson } from './personHelpers'
import { titlesOf, findPeopleWithTitles } from './staffFromTitles'
import type { TitleValue } from '@/access/titles'

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
  titles: Array<{ title: TitleValue; isLead: boolean; label: string }>
  socialLinks: {
    twitter?: string
    twitch?: string
    youtube?: string
    instagram?: string
    tiktok?: string
    customLinks?: { label: string; url: string }[]
  }
}

/**
 * Get player information by name
 * @param personSlug - Optional slug from People collection. When provided, matches team entries by slug (not name) to correctly distinguish players with the same display name.
 */
export async function getPlayerByName(name: string, personSlug?: string): Promise<PlayerInfo | null> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return null
  }

  try {
    const allTeams = await getAllTeams()
    const payload = await getPayload({ config: configPromise })

  const slug = personSlug || formatSlug(name)
  const teams: PlayerTeamInfo[] = []

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

  // Helper to check if a team entry matches the player
  // When personSlug is provided, match by slug (unique) to avoid merging different players with the same name
  // Note: allTeams is already transformed, entries have 'name' and 'slug' properties (from extractPersonData)
  const matchesTeamEntry = (entry: any): boolean => {
    // Prefer slug matching when personSlug is provided (handles duplicate names)
    if (personSlug && entry.slug && typeof entry.slug === 'string') {
      return entry.slug === personSlug
    }
    // Fallback to name matching (backward compatibility)
    if (entry.name && typeof entry.name === 'string') {
      return entry.name.toLowerCase() === name.toLowerCase()
    }
    return false
  }

  // Check all teams for this player
  allTeams.forEach((team) => {
    // Check roster
    const rosterPlayer = team.roster?.find((p) => matchesTeamEntry(p))
    if (rosterPlayer) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      teamEntry.role = rosterPlayer.role
      addPosition(teamEntry, 'player')
      Object.assign(socialLinks, rosterPlayer)
    }

    // Check subs
    const subPlayer = team.subs?.find((s) => matchesTeamEntry(s))
    if (subPlayer) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      addPosition(teamEntry, 'sub')
      Object.assign(socialLinks, subPlayer)
    }

    // Check captain
    const captain = team.captain?.find((c) => matchesTeamEntry(c))
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
    const manager = team.manager?.find((m) => matchesTeamEntry(m))
    if (manager) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      addPosition(teamEntry, 'manager')
      Object.assign(socialLinks, manager)
    }

    // Check coaches
    const coach = team.coaches?.find((c) => matchesTeamEntry(c))
    if (coach) {
      const teamEntry = getOrCreateTeam(team.slug, team.name, team.logo)
      addPosition(teamEntry, 'coach')
      Object.assign(socialLinks, coach)
    }
  })

  // Fetch person's bio, photo, and titles from the People collection
  let bio: string | undefined = undefined
  let photo: number | null | undefined = undefined
  let photoUrl: string | null = null
  let titles: PlayerInfo['titles'] = []

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

    let person = personBySlug.docs[0]
    if (!person) {
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
      person = personByName.docs[0]
    }

    if (person && isPopulatedPerson(person)) {
      bio = person.bio || undefined
      photo = getPhotoIdFromPerson(person)
      photoUrl = getPhotoUrlFromPerson(person)
      titles = titlesOf(person as any)
      // Social links are only stored on the People collection; team entries already carry a
      // copy for players/subs/captains/managers/coaches, but a staff-only person (no team) has
      // no other source, so merge theirs in here too.
      Object.assign(socialLinks, getSocialLinksFromPerson(person))
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
      titles,
      socialLinks,
    }
  } catch (_error) {
    // During build, database may not be available
    console.error('[getPlayerByName] Error fetching player:', name, _error)
    return null
  }
}

/**
 * Get all unique player names from all teams and the People collection (anyone with a title
 * counts as staff and gets a player page, plus everyone else already in People)
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

    // Add names of everyone with a title (replaces the old organization-staff/production lookups)
    const titledPeople = await findPeopleWithTitles(payload, 0)
    titledPeople.forEach((person) => {
      if (person.name) playerNames.add(person.name)
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
