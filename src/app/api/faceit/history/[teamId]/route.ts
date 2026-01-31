import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * GET /api/faceit/history/[teamId]
 * 
 * Returns archived season history for a team.
 * Only returns seasons with isActive: false and archivedMatches.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId: teamIdStr } = await params
    const teamId = parseInt(teamIdStr)
    
    if (isNaN(teamId)) {
      return NextResponse.json(
        { error: 'Invalid team ID' },
        { status: 400 }
      )
    }
    
    const payload = await getPayload({ config: configPromise })
    
    // Find all archived seasons for this team
    const archivedSeasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        and: [
          { team: { equals: teamId } },
          { isActive: { equals: false } },
        ],
      },
      depth: 1, // Populate faceitLeague for league name
      limit: 50,
      sort: '-archivedAt', // Most recent first
    })
    
    // Transform to cleaner response format
    const seasons = archivedSeasons.docs.map((season: any) => {
      const standings = season.standings || {}
      const archivedMatches = season.archivedMatches || []
      
      // Count wins/losses from archived matches
      const wins = archivedMatches.filter((m: any) => m.result === 'win').length
      const losses = archivedMatches.filter((m: any) => m.result === 'loss').length
      
      return {
        id: season.id,
        seasonName: season.seasonName || 
          (typeof season.faceitLeague === 'object' ? season.faceitLeague?.name : null) ||
          'Unknown Season',
        division: season.division || standings.division || null,
        region: season.region || standings.region || null,
        record: `${wins}-${losses}`,
        wins,
        losses,
        rank: standings.currentRank || null,
        totalTeams: standings.totalTeams || null,
        points: standings.points || null,
        archivedAt: season.archivedAt,
        matches: archivedMatches.map((match: any) => ({
          date: match.matchDate,
          opponent: match.opponent,
          result: match.result,
          roomLink: match.faceitMatchId 
            ? `https://www.faceit.com/en/ow2/room/${match.faceitMatchId}`
            : null,
        })),
      }
    })
    
    return NextResponse.json({ seasons })
    
  } catch (error: any) {
    console.error('[Season History] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch season history' },
      { status: 500 }
    )
  }
}
