import type { Payload, PayloadRequest } from 'payload'
import teamsData from '@/data/teams.json'

interface TeamPlayer {
  name: string
  role: 'tank' | 'dps' | 'support'
}

interface Team {
  slug: string
  name: string
  logo: string
  region?: string
  rating?: string
  achievements?: string[]
  manager?: string[]
  coaches?: string[]
  captain?: string[]
  coCaptain?: string | null
  roster?: TeamPlayer[]
  subs?: string[]
}

interface TeamsData {
  teams: Team[]
}

/**
 * Format name to slug (same logic as People collection)
 */
function formatSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars and emojis
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Create or find a person by name and return their ID
 * Searches by slug first to avoid duplicates (e.g., "Ant" vs "Ant 🐜")
 */
async function getPersonId(payload: Payload, name: string): Promise<number> {
  const trimmedName = name.trim()
  const slug = formatSlug(trimmedName)
  
  // Try to find existing person by slug first (since slug is unique and auto-generated)
  // This prevents duplicates when names format to the same slug (e.g., "Ant" vs "Ant 🐜")
  const existingBySlug = await payload.find({
    collection: 'people',
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
    depth: 0,
  })
  
  if (existingBySlug.docs.length > 0) {
    const id = existingBySlug.docs[0].id
    return typeof id === 'number' ? id : parseInt(String(id))
  }
  
  // Create new person (slug will be auto-generated from name)
  const newPerson = await payload.create({
    collection: 'people',
    data: {
      name: trimmedName,
    } as any,
  })
  
  const id = newPerson.id
  return typeof id === 'number' ? id : parseInt(String(id))
}

/**
 * Transform JSON team data to Payload format with People relationships
 */
async function transformTeamToPayload(payload: Payload, team: Team) {
  // Create/get People entries for all team members
  const managerEntries = await Promise.all(
    (team.manager || []).map(async (name) => {
      const personId = await getPersonId(payload, name)
      return { person: personId }
    })
  )
  
  const coachEntries = await Promise.all(
    (team.coaches || []).map(async (name) => {
      const personId = await getPersonId(payload, name)
      return { person: personId }
    })
  )
  
  const captainEntries = await Promise.all(
    (team.captain || []).map(async (name) => {
      const personId = await getPersonId(payload, name)
      return { person: personId }
    })
  )
  
  const coCaptainId = team.coCaptain 
    ? await getPersonId(payload, team.coCaptain)
    : undefined
  
  const rosterEntries = await Promise.all(
    (team.roster || []).map(async (player) => {
      const personId = await getPersonId(payload, player.name)
      return {
        person: personId,
        role: player.role,
      }
    })
  )
  
  const subEntries = await Promise.all(
    (team.subs || []).map(async (name) => {
      const personId = await getPersonId(payload, name)
      return { person: personId }
    })
  )

  return {
    slug: team.slug,
    name: team.name,
    logo: team.logo,
    region: team.region || undefined,
    rating: team.rating || undefined,
    achievements: (team.achievements || []).map((achievement) => ({
      achievement,
    })),
    manager: managerEntries,
    coaches: coachEntries,
    captain: captainEntries,
    coCaptain: coCaptainId || undefined,
    roster: rosterEntries,
    subs: subEntries,
  }
}

export const seedTeams = async ({
  payload,
  req,
  clearExisting = true,
  clearPeople = false,
}: {
  payload: Payload
  req: PayloadRequest
  clearExisting?: boolean
  clearPeople?: boolean
}): Promise<void> => {
  payload.logger.info('Seeding teams...')
  payload.logger.info('This will create People entries for all team members and link Teams to them.')

  // Clear existing teams if requested
  if (clearExisting) {
    payload.logger.info('Clearing existing teams...')
    try {
      // First, try to get all teams to verify they exist
      const existingTeams = await payload.find({
        collection: 'teams',
        limit: 1000,
        pagination: false,
        req,
      })
      
      payload.logger.info(`Found ${existingTeams.docs.length} existing teams to delete`)
      
      if (existingTeams.docs.length > 0) {
        // Delete teams individually to ensure proper cleanup of relationships
        let deletedCount = 0
        for (const team of existingTeams.docs) {
          try {
            await payload.delete({
              collection: 'teams',
              id: team.id,
              req,
            })
            deletedCount++
          } catch (deleteError: any) {
            payload.logger.warn(`Failed to delete team ${team.id} (${team.slug || 'unknown'}): ${deleteError.message}`)
          }
        }
        payload.logger.info(`Deleted ${deletedCount} of ${existingTeams.docs.length} existing teams`)
        
        // Verify deletion by checking again
        const remainingTeams = await payload.find({
          collection: 'teams',
          limit: 1000,
          pagination: false,
          req,
        })
        
        if (remainingTeams.docs.length > 0) {
          payload.logger.warn(`Warning: ${remainingTeams.docs.length} teams still remain after deletion. Attempting deleteMany...`)
          // Try deleteMany as final cleanup
          await payload.db.deleteMany({
            collection: 'teams',
            where: {},
            req,
          })
          payload.logger.info('Used deleteMany to clear remaining teams')
        }
      } else {
        payload.logger.info('No existing teams to delete')
      }
    } catch (error: any) {
      payload.logger.error(`Error clearing teams: ${error.message}`)
      // Try deleteMany as fallback
      try {
        await payload.db.deleteMany({
          collection: 'teams',
          where: {},
          req,
        })
        payload.logger.info('Cleared all existing teams (using deleteMany fallback)')
      } catch (fallbackError: any) {
        payload.logger.error(`Error clearing teams (fallback): ${fallbackError.message}`)
        // Don't throw - allow seeding to continue, might work anyway
        payload.logger.warn('Continuing with seeding despite clearing errors - teams may already exist')
      }
    }
  }

  // Optionally clear People entries (WARNING: This will delete ALL people, including those used by other collections)
  if (clearPeople) {
    payload.logger.warn('⚠️  Clearing ALL People entries - this will affect OrganizationStaff and Production collections!')
    try {
      await payload.db.deleteMany({
        collection: 'people',
        where: {},
        req,
      })
      payload.logger.info('Cleared all existing People entries')
    } catch (error: any) {
      payload.logger.error(`Error clearing people: ${error.message}`)
      // Continue anyway
    }
  }

  const teams = (teamsData as TeamsData).teams
  let createdCount = 0
  let updatedCount = 0
  let errorCount = 0

  for (const team of teams) {
    try {
      // Transform team data with People relationships
      const teamData = await transformTeamToPayload(payload, team)

      // Always check if team already exists (in case clearing failed)
      const existingTeam = await payload.find({
        collection: 'teams',
        where: {
          slug: {
            equals: team.slug,
          },
        },
        limit: 1,
        req,
      })

      if (existingTeam.docs.length > 0) {
        // Update existing team instead of failing
        // Use depth: 0 to ensure we're updating with fresh data
        await payload.update({
          collection: 'teams',
          id: existingTeam.docs[0].id,
          data: teamData as any,
          depth: 0,
          req,
        })
        payload.logger.info(`Updated team: ${team.name}`)
        updatedCount++
        continue
      }

      // Create new team
      await payload.create({
        collection: 'teams',
        data: teamData as any,
        req,
      })
      payload.logger.info(`Created team: ${team.name}`)
      createdCount++
    } catch (error: any) {
      payload.logger.error(`Error seeding team ${team.name}: ${error.message}`)
      if (error.stack) {
        payload.logger.error(error.stack)
      }
      errorCount++
    }
  }

  payload.logger.info(`Seeding complete: ${createdCount} created, ${updatedCount} updated, ${errorCount} errors`)
  payload.logger.info(`Total teams processed: ${teams.length}`)
}

