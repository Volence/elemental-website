/**
 * GET /api/people-search?q=searchTerm
 *
 * Searches ALL People records by name or gameAliases.
 * Returns matching people with their id, name, and aliases.
 * Used by the scrim upload player mapping to find anyone in the system.
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

    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim() || ''

    if (q.length < 2) {
      return NextResponse.json({ people: [] })
    }

    // Search by name OR gameAliases
    const results = await payload.find({
      collection: 'people',
      where: {
        or: [
          { name: { contains: q } },
          { 'gameAliases.alias': { contains: q } },
        ],
      },
      limit: 20,
      depth: 0,
      sort: 'name',
    })

    const people = results.docs.map((person: any) => ({
      id: person.id,
      name: person.name,
      gameAliases: (person.gameAliases || []).map((ga: any) => ga.alias).filter(Boolean),
    }))

    return NextResponse.json({ people })
  } catch (error) {
    console.error('People search error:', error)
    return NextResponse.json({ error: 'Failed to search people' }, { status: 500 })
  }
}
