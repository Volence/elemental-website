import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

/**
 * Players sitemap - only includes people who are:
 * - On a team roster
 * - A team manager
 * - A team coach
 * - Organization staff
 *
 * This excludes opponents and other random people entries.
 */
const getPlayersSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://elmt.gg'

    // Collect all valid person IDs from teams
    const validPersonIds = new Set<number | string>()

    // 1. Get all teams with their roster, manager, coaches
    const teams = await payload.find({
      collection: 'teams',
      depth: 1,
      limit: 1000,
      pagination: false,
      select: {
        roster: true,
        manager: true,
        coaches: true,
        captain: true,
      },
    })

    for (const team of teams.docs) {
      // Roster players
      if (team.roster && Array.isArray(team.roster)) {
        for (const entry of team.roster) {
          const personId = typeof entry.person === 'number' || typeof entry.person === 'string' 
            ? entry.person 
            : (entry.person as any)?.id
          if (personId) validPersonIds.add(personId)
        }
      }

      // Managers
      if (team.manager && Array.isArray(team.manager)) {
        for (const m of team.manager) {
          const personId = typeof m === 'number' || typeof m === 'string' ? m : (m as any)?.id
          if (personId) validPersonIds.add(personId)
        }
      }

      // Coaches
      if (team.coaches && Array.isArray(team.coaches)) {
        for (const c of team.coaches) {
          const personId = typeof c === 'number' || typeof c === 'string' ? c : (c as any)?.id
          if (personId) validPersonIds.add(personId)
        }
      }

      // Captains
      if (team.captain && Array.isArray(team.captain)) {
        for (const c of team.captain) {
          const personId = typeof c === 'number' || typeof c === 'string' ? c : (c as any)?.id
          if (personId) validPersonIds.add(personId)
        }
      }
    }

    // 2. Get organization staff
    const orgStaff = await payload.find({
      collection: 'organization-staff',
      depth: 1,
      limit: 1000,
      pagination: false,
      select: {
        person: true,
      },
    })

    for (const staff of orgStaff.docs) {
      const personId = typeof staff.person === 'number' ? staff.person : (staff.person as any)?.id
      if (personId) validPersonIds.add(personId)
    }

    // 3. If no valid people found, return empty sitemap
    if (validPersonIds.size === 0) {
      return []
    }

    // 4. Fetch the actual people with their slugs
    const people = await payload.find({
      collection: 'people',
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        id: {
          in: Array.from(validPersonIds),
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        name: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = people.docs
      .filter((person) => Boolean(person?.slug))
      .map((person) => ({
        loc: `${SITE_URL}/players/${person.slug}`,
        lastmod: String(person.updatedAt || dateFallback),
        changefreq: 'weekly' as const,
        priority: 0.6,
      }))

    return sitemap
  },
  ['players-sitemap'],
  {
    tags: ['players-sitemap'],
    revalidate: 3600, // Revalidate every hour
  },
)

export async function GET() {
  const sitemap = await getPlayersSitemap()

  return getServerSideSitemap(sitemap)
}
