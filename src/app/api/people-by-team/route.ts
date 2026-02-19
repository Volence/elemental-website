/**
 * GET /api/people-by-team?teamId=123
 *
 * Returns People records associated with a given team (from the team's roster and subs),
 * including their gameAliases for auto-resolution during scrim upload.
 */

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(request: Request) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    // Fetch the team with populated roster and subs person references
    const team = await payload.findByID({
      collection: 'teams',
      id: Number(teamId),
      depth: 2, // populate roster[].person and subs[].person
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Collect all person IDs from roster and subs
    const personIds = new Set<number>()
    const rosterEntries = (team.roster || []) as { person?: { id?: number } | number }[]
    const subEntries = (team.subs || []) as { person?: { id?: number } | number }[]

    for (const entry of [...rosterEntries, ...subEntries]) {
      if (entry.person) {
        const id = typeof entry.person === 'object' ? entry.person.id : entry.person
        if (id) personIds.add(id)
      }
    }

    if (personIds.size === 0) {
      return NextResponse.json({ people: [] })
    }

    // Fetch the People records with gameAliases
    const people = await payload.find({
      collection: 'people',
      where: {
        id: { in: Array.from(personIds) },
      },
      limit: 200,
      sort: 'name',
      depth: 0,
    })

    const simplified = people.docs.map((person) => {
      const aliases: string[] = []
      if (Array.isArray((person as Record<string, unknown>).gameAliases)) {
        for (const entry of (person as Record<string, unknown>).gameAliases as { alias?: string }[]) {
          if (entry.alias) {
            aliases.push(entry.alias)
          }
        }
      }

      return {
        id: person.id,
        name: person.name || 'Unknown',
        gameAliases: aliases,
      }
    })

    return NextResponse.json({ people: simplified })
  } catch (error) {
    console.error('People by team error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 },
    )
  }
}
