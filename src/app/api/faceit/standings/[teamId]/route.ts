import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * GET /api/faceit/standings/[teamId]
 * 
 * Get current FaceIt standings for a team (public endpoint).
 * Returns current season + historical seasons.
 */
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const teamId = parseInt(params.teamId)
    
    if (isNaN(teamId)) {
      return NextResponse.json(
        { error: 'Invalid team ID' },
        { status: 400 }
      )
    }
    
    const payload = await getPayload({ config: configPromise })
    
    // Get current season
    const currentSeasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        and: [
          { team: { equals: teamId } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
    })
    
    const currentSeason = currentSeasons.docs[0] || null
    
    // Get historical seasons (not hidden)
    const historicalSeasons = await payload.find({
      collection: 'faceit-seasons-archive',
      where: {
        and: [
          { team: { equals: teamId } },
          { hideHistoricalData: { equals: false } },
        ],
      },
      sort: '-seasonName',
      limit: 10,
    })
    
    // Format response
    const response = {
      currentSeason: currentSeason ? {
        season: currentSeason.seasonName,
        rank: currentSeason.standings?.currentRank,
        totalTeams: currentSeason.standings?.totalTeams,
        record: `${currentSeason.standings?.wins}-${currentSeason.standings?.losses}`,
        wins: currentSeason.standings?.wins,
        losses: currentSeason.standings?.losses,
        ties: currentSeason.standings?.ties,
        points: currentSeason.standings?.points,
        division: currentSeason.division,
        region: currentSeason.region,
        lastSynced: currentSeason.lastSynced,
      } : null,
      historicalSeasons: historicalSeasons.docs.map(season => ({
        season: season.seasonName,
        rank: season.standings?.currentRank,
        totalTeams: season.standings?.totalTeams,
        record: `${season.standings?.wins}-${season.standings?.losses}`,
        wins: season.standings?.wins,
        losses: season.standings?.losses,
        points: season.standings?.points,
        division: season.division,
        region: season.region,
      })),
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('[FaceIt API] Standings error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

