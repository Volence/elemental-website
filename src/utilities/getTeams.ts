import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { sortTeams } from './sortTeams'
import { isPopulatedPerson, getPersonNameFromRelationship, getSocialLinksFromPerson, getPhotoUrlFromPerson } from './personHelpers'
import type { Team as PayloadTeam } from '@/payload-types'

// Type aliases for Payload team entry types
type TeamManager = NonNullable<PayloadTeam['manager']>[0]
type TeamCoach = NonNullable<PayloadTeam['coaches']>[0]
type TeamCaptain = NonNullable<PayloadTeam['captain']>[0]
type TeamRoster = NonNullable<PayloadTeam['roster']>[0]
type TeamSubEntry = NonNullable<PayloadTeam['subs']>[0]
type TeamEntry = TeamManager | TeamCoach | TeamCaptain | TeamRoster | TeamSubEntry

export interface CustomLink {
  label: string
  url: string
}

export interface SocialLinks {
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
  tiktok?: string
  customLinks?: CustomLink[]
}

export interface TeamPlayer {
  name: string
  role: 'tank' | 'dps' | 'support'
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

export interface TeamStaff {
  name: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

export interface TeamSub {
  name: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

export interface Team {
  slug: string
  name: string
  logo: string
  region?: string
  rating?: string
  themeColor?: string
  achievements?: string[]
  manager?: TeamStaff[]
  coaches?: TeamStaff[]
  captain?: TeamStaff[]
  coCaptain?: string | null
  roster?: TeamPlayer[]
  subs?: TeamSub[]
}

/**
 * Helper to extract name, photo, and social links from a person entry (uses People relationship)
 */
function extractPersonData(entry: TeamEntry): { name: string; photoUrl?: string | null; socialLinks: { twitter?: string; twitch?: string; youtube?: string; instagram?: string } } {
  // Person relationship is required - extract from populated person object
  const personName = getPersonNameFromRelationship(entry.person)
  
  if (personName) {
    // Person is populated, use it - social links and photo are only in the person relationship
    return {
      name: personName,
      photoUrl: getPhotoUrlFromPerson(entry.person),
      socialLinks: getSocialLinksFromPerson(entry.person),
    }
  }
  
  // Person not populated or missing - log details for debugging
  if (process.env.NODE_ENV === 'development') {
    if (entry.person) {
      const personType = typeof entry.person
      const personValue = entry.person
      if (personType === 'object' && personValue !== null) {
        const personObj = personValue as unknown as Record<string, unknown>
        console.warn('[getTeams] Person relationship not populated (ID only):', {
          personType,
          personValue: { id: personObj.id, hasName: 'name' in personObj },
          entryKeys: Object.keys(entry),
        })
      } else {
        console.warn('[getTeams] Person relationship not populated (ID only):', {
          personType,
          personValue,
          entryKeys: Object.keys(entry),
        })
      }
    } else {
      console.warn('[getTeams] Entry missing person relationship:', {
        entryKeys: Object.keys(entry),
      })
    }
  }
  
  // Fallback: return empty name if person not populated
  // This will be filtered out later
  return {
    name: '',
    photoUrl: null,
    socialLinks: {},
  }
}

/**
 * Transform Payload team data to our Team interface
 */
function transformPayloadTeam(payloadTeam: PayloadTeam): Team | null {
  try {
    // Validate required fields
    if (!payloadTeam.slug || !payloadTeam.name || !payloadTeam.logo) {
      console.warn(`[getTeams] Skipping team with missing required fields:`, {
        slug: payloadTeam.slug,
        name: payloadTeam.name,
        logo: payloadTeam.logo,
        id: payloadTeam.id,
      })
      return null
    }


    return {
      slug: payloadTeam.slug,
      name: payloadTeam.name,
      logo: payloadTeam.logo,
      region: payloadTeam.region || undefined,
      rating: payloadTeam.rating || undefined,
      themeColor: payloadTeam.themeColor || undefined,
      achievements: payloadTeam.achievements?.map((a) => a.achievement).filter((a): a is string => Boolean(a)) || [],
      manager: payloadTeam.manager?.map((m: TeamManager) => {
        const data = extractPersonData(m)
        return {
          name: data.name,
          photoUrl: data.photoUrl,
          ...data.socialLinks,
        } as TeamStaff
      }).filter((m) => Boolean(m.name && m.name.trim() !== '')) || [], // Filter out empty names
      coaches: payloadTeam.coaches?.map((c: TeamCoach) => {
        const data = extractPersonData(c)
        return {
          name: data.name,
          photoUrl: data.photoUrl,
          ...data.socialLinks,
        } as TeamStaff
      }).filter((c) => Boolean(c.name && c.name.trim() !== '')) || [], // Filter out empty names
      captain: payloadTeam.captain?.map((c: TeamCaptain) => {
        const data = extractPersonData(c)
        return {
          name: data.name,
          photoUrl: data.photoUrl,
          ...data.socialLinks,
        } as TeamStaff
      }).filter((c) => Boolean(c.name && c.name.trim() !== '')) || [], // Filter out empty names
      coCaptain: (() => {
        // Handle relationship field (object with name)
        // coCaptain can be a Person relationship or a string (legacy)
        if (payloadTeam.coCaptain) {
          if (isPopulatedPerson(payloadTeam.coCaptain)) {
            return payloadTeam.coCaptain.name
          }
          // Legacy string format
          if (typeof payloadTeam.coCaptain === 'string') {
            return payloadTeam.coCaptain
          }
        }
        return null
      })(),
      roster: payloadTeam.roster?.map((p) => {
        const data = extractPersonData(p)
        return {
          name: data.name,
          role: p.role,
          photoUrl: data.photoUrl,
          ...data.socialLinks,
        } as TeamPlayer
      }).filter((p) => Boolean(p.name && p.name.trim() !== '')) || [], // Filter out empty names
      subs: payloadTeam.subs?.map((s: TeamSubEntry) => {
        const data = extractPersonData(s)
        return {
          name: data.name,
          photoUrl: data.photoUrl,
          ...data.socialLinks,
        } as TeamSub
      }).filter((s) => Boolean(s.name && s.name.trim() !== '')) || [], // Filter out empty names
    }
  } catch (error) {
    console.error(`[getTeams] Error transforming team ${payloadTeam.slug || payloadTeam.id}:`, error)
    return null
  }
}

/**
 * Get all teams from Payload CMS
 */
export async function getAllTeams(): Promise<Team[]> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return []
  }

  try {
    const payload = await getPayload({ config: configPromise })
    
    const result = await payload.find({
      collection: 'teams',
      limit: 1000,
      pagination: false,
      overrideAccess: false,
      depth: 2, // Populate People relationships (depth 2 needed for nested relationships in arrays)
    })

    // Transform teams and filter out any that failed transformation
    const teams = result.docs
      .map(transformPayloadTeam)
      .filter((team): team is Team => team !== null)
    
    // Only log errors or significant issues, not every successful fetch
    
    return sortTeams(teams)
  } catch (error) {
    // Log error for debugging
    console.error('Error fetching teams:', error)
    // During build, database may not be available
    // In production, log but still return empty array to prevent page crashes
    if (process.env.NODE_ENV === 'development') {
      throw error
    }
    return []
  }
}

/**
 * Get a team by slug from Payload CMS
 */
export async function getTeamBySlug(slug: string): Promise<Team | undefined> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return undefined
  }

  try {
    const payload = await getPayload({ config: configPromise })
    
    const result = await payload.find({
      collection: 'teams',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      overrideAccess: false,
      depth: 2, // Populate People relationships and their nested photo relationship
    })

    if (result.docs.length === 0) {
      return undefined
    }

    const team = transformPayloadTeam(result.docs[0])
    
    return team || undefined
  } catch (error) {
    // Log error for debugging
    console.error('Error fetching team by slug:', error)
    // During build, database may not be available
    if (process.env.NODE_ENV === 'development') {
      throw error
    }
    return undefined
  }
}

/**
 * Get teams that have a roster
 */
export async function getTeamsWithRoster(): Promise<Team[]> {
  const allTeams = await getAllTeams()
  return allTeams.filter((team) => team.roster && team.roster.length > 0)
}

