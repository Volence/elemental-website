import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Person } from '@/payload-types'
import { finalizeLeague } from '@/utilities/faceitFinalize'

/**
 * Finalize Season API
 *
 * Archives FACEIT data for every active league whose name contains
 * `nameFilter`, then marks those leagues and their team seasons inactive.
 * The per-league work lives in `finalizeLeague` (shared with the rollover).
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user || (user as Person).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { nameFilter } = body
    if (!nameFilter || typeof nameFilter !== 'string' || !nameFilter.trim()) {
      return NextResponse.json({ error: 'nameFilter is required (string)' }, { status: 400 })
    }
    const filterLower = nameFilter.toLowerCase().trim()

    const allActive = await payload.find({ collection: 'faceit-leagues', where: { isActive: { equals: true } }, limit: 100 })
    const leagues = allActive.docs.filter((l: any) => l.name.toLowerCase().includes(filterLower))
    if (leagues.length === 0) {
      return NextResponse.json({ error: `No active leagues found matching "${nameFilter}"` }, { status: 404 })
    }

    const results = { leaguesFinalized: 0, seasonsArchived: 0, matchesArchived: 0, errors: [] as string[] }
    for (const league of leagues as any[]) {
      try {
        const r = await finalizeLeague(payload, league)
        results.leaguesFinalized++
        results.seasonsArchived += r.seasonsArchived
        results.matchesArchived += r.matchesArchived
        results.errors.push(...r.errors)
      } catch (err: any) {
        results.errors.push(`League ${league.name}: ${err.message}`)
      }
    }
    return NextResponse.json({ success: true, nameFilter, ...results })
  } catch (error: any) {
    console.error('[Finalize Season] Error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
