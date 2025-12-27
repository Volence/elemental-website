import type { CollectionAfterChangeHook } from 'payload'
import type { Person } from '@/payload-types'

/**
 * Auto-close recruitment listings when a person is assigned to a team role
 * 
 * This hook runs after a Person is created or updated. It checks if the person
 * has been assigned to a team (as player, manager, or coach), and if so, finds
 * any open recruitment listings for that team + role combination and closes them.
 */
export const autoCloseRecruitment: CollectionAfterChangeHook<Person> = async ({
  doc,
  req,
  operation,
}) => {
  // Only run on create and update operations
  if (operation !== 'create' && operation !== 'update') return doc

  try {
    // 1. Check player roster assignments
    const playerTeams = await req.payload.find({
      collection: 'teams',
      where: {
        'roster.person': {
          equals: doc.id,
        },
      },
      depth: 1,
      limit: 100,
    })

    for (const team of playerTeams.docs) {
      if (!team.roster || !Array.isArray(team.roster)) continue

      const rosterEntry = team.roster.find((r: any) => {
        const personId = typeof r.person === 'number' ? r.person : r.person?.id
        return personId === doc.id
      })

      if (rosterEntry?.role) {
        await closeMatchingListings(req, team.id, rosterEntry.role, 'player', doc, team.name)
      }
    }

    // 2. Check manager assignments
    const managerTeams = await req.payload.find({
      collection: 'teams',
      where: {
        manager: {
          equals: doc.id,
        },
      },
      depth: 1,
      limit: 100,
    })

    for (const team of managerTeams.docs) {
      await closeMatchingListings(req, team.id, 'manager', 'team-staff', doc, team.name)
    }

    // 3. Check coach assignments
    const coachTeams = await req.payload.find({
      collection: 'teams',
      where: {
        coaches: {
          contains: doc.id,
        },
      },
      depth: 1,
      limit: 100,
    })

    for (const team of coachTeams.docs) {
      // Could be head coach or assistant coach - close both coach and assistant-coach listings
      await closeMatchingListings(req, team.id, 'coach', 'team-staff', doc, team.name)
      await closeMatchingListings(req, team.id, 'assistant-coach', 'team-staff', doc, team.name)
    }
  } catch (error) {
    console.error('Error in autoCloseRecruitment hook:', error)
    // Don't throw - we don't want to block the person save if this fails
  }

  return doc
}

/**
 * Helper function to find and close matching recruitment listings
 */
async function closeMatchingListings(
  req: any,
  teamId: number | string,
  role: string,
  category: 'player' | 'team-staff',
  person: Person,
  teamName: string,
) {
  const openListings = await req.payload.find({
    collection: 'recruitment-listings',
    where: {
      and: [
        {
          team: {
            equals: teamId,
          },
        },
        {
          category: {
            equals: category,
          },
        },
        {
          role: {
            equals: role,
          },
        },
        {
          status: {
            equals: 'open',
          },
        },
      ],
    },
    limit: 10,
  })

  for (const listing of openListings.docs) {
    await req.payload.update({
      collection: 'recruitment-listings',
      id: listing.id,
      data: {
        status: 'filled',
        filledBy: person.id,
      },
    })

    console.log(
      `Auto-closed ${category} recruitment listing ${listing.id} (Team: ${teamName}, Role: ${role}, Filled by: ${person.name})`,
    )
  }
}

