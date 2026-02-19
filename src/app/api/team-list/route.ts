/**
 * GET /api/teams
 * Returns a list of teams for use in dropdowns (e.g., scrim upload team selector).
 * Only returns id and name — lightweight for client consumption.
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

    const teams = await payload.find({
      collection: 'teams',
      limit: 100,
      sort: 'name',
      depth: 0,
    })

    const simplified = teams.docs.map((team) => ({
      id: team.id,
      name: team.name,
    }))

    return NextResponse.json({ teams: simplified })
  } catch (error) {
    console.error('Teams API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 },
    )
  }
}
