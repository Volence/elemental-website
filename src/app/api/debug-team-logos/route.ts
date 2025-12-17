import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getAllTeams } from '@/utilities/getTeams'

/**
 * Debug endpoint to check team logo paths
 * Usage: GET /api/debug-team-logos
 */
export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const allTeams = await getAllTeams()
    
    // Check specific teams mentioned
    const problematicTeams = ['eclipse', 'void', 'cosmic']
    
    const teamInfo = problematicTeams.map(slug => {
      const team = allTeams.find(t => t.slug === slug)
      return {
        slug,
        found: !!team,
        logo: team?.logo || 'NOT FOUND',
        name: team?.name || 'NOT FOUND',
      }
    })
    
    // Also get raw data from database
    const dbTeams = await payload.find({
      collection: 'teams',
      where: {
        slug: {
          in: problematicTeams,
        },
      },
      limit: 10,
      depth: 0,
    })
    
    return NextResponse.json({
      totalTeams: allTeams.length,
      problematicTeams: teamInfo,
      dbTeams: dbTeams.docs.map(t => ({
        slug: t.slug,
        name: t.name,
        logo: t.logo,
      })),
      allTeamLogos: allTeams.map(t => ({
        slug: t.slug,
        name: t.name,
        logo: t.logo,
      })),
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
