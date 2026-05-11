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
    
    // Get historical seasons (inactive, not hidden)
    const historicalSeasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        and: [
          { team: { equals: teamId } },
          { isActive: { equals: false } },
        ],
      },
      sort: '-seasonName',
      limit: 10,
    })
    
    // Check for playoff season
    const playoffSeasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        and: [
          { team: { equals: teamId } },
          { inPlayoffs: { equals: true } },
        ],
      },
      limit: 1,
    })

    const playoffSeason = playoffSeasons.docs[0] || null

    // If no active season but there IS a playoff season, use the playoff season's
    // regular-season data as the "current" display so the section still renders
    let effectiveCurrentSeason = currentSeason
    if (!currentSeason && playoffSeason) {
      effectiveCurrentSeason = playoffSeason
    }

    // Filter historical seasons: exclude the season that's shown as current/playoff
    const playoffSeasonId = playoffSeason?.id
    const currentSeasonId = effectiveCurrentSeason?.id
    const filteredHistory = historicalSeasons.docs.filter(s =>
      s.id !== playoffSeasonId && s.id !== currentSeasonId
    )

    const response = {
      currentSeason: effectiveCurrentSeason ? {
        season: effectiveCurrentSeason.seasonName,
        rank: effectiveCurrentSeason.standings?.currentRank,
        totalTeams: effectiveCurrentSeason.standings?.totalTeams,
        record: `${effectiveCurrentSeason.standings?.wins}-${effectiveCurrentSeason.standings?.losses}`,
        wins: effectiveCurrentSeason.standings?.wins,
        losses: effectiveCurrentSeason.standings?.losses,
        ties: effectiveCurrentSeason.standings?.ties,
        points: effectiveCurrentSeason.standings?.points,
        division: effectiveCurrentSeason.division,
        region: effectiveCurrentSeason.region,
        lastSynced: effectiveCurrentSeason.lastSynced,
      } : null,
      playoff: playoffSeason ? {
        season: playoffSeason.seasonName,
        record: `${(playoffSeason as any).playoffStandings?.wins || 0}-${(playoffSeason as any).playoffStandings?.losses || 0}`,
        wins: (playoffSeason as any).playoffStandings?.wins || 0,
        losses: (playoffSeason as any).playoffStandings?.losses || 0,
        eliminated: (playoffSeason as any).playoffStandings?.eliminated || false,
        division: playoffSeason.division,
        region: playoffSeason.region,
      } : null,
      historicalSeasons: filteredHistory.map(season => ({
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

