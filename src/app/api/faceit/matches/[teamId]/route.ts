import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * GET /api/faceit/matches/[teamId]
 * 
 * Get FaceIt matches for a team (public endpoint).
 * Returns scheduled matches and recent results.
 * 
 * Query params:
 *   ?season=current (default) or ?season=[seasonId]
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
    
    const { searchParams } = new URL(request.url)
    const seasonParam = searchParams.get('season') || 'current'
    
    const payload = await getPayload({ config: configPromise })
    
    // Get season ID
    let faceitSeasonId: number | null = null
    
    if (seasonParam === 'current') {
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
      faceitSeasonId = currentSeasons.docs[0]?.id || null
    } else {
      faceitSeasonId = parseInt(seasonParam)
    }
    
    if (!faceitSeasonId) {
      return NextResponse.json({
        scheduled: [],
        results: [],
      })
    }
    
    // Get all matches for this team and season
    const now = new Date()
    
    // Scheduled matches (future)
    const scheduledMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { team: { equals: teamId } },
          { faceitSeasonId: { equals: faceitSeasonId } },
          { date: { greater_than: now.toISOString() } },
        ],
      },
      sort: 'date',
      limit: 10,
    })
    
    // Recent results (past)
    const recentResults = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { team: { equals: teamId } },
          { faceitSeasonId: { equals: faceitSeasonId } },
          { date: { less_than_equal: now.toISOString() } },
        ],
      },
      sort: '-date',
      limit: 10,
    })
    
    // Format response
    const response = {
      scheduled: scheduledMatches.docs.map(match => ({
        id: match.id,
        date: match.date,
        opponent: match.opponent,
        region: match.region,
        league: match.league,
        roomLink: match.faceitLobby,
        faceitRoomId: match.faceitRoomId,
      })),
      results: recentResults.docs.map(match => {
        const elmtScore = (match.score as any)?.elmtScore
        const opponentScore = (match.score as any)?.opponentScore
        
        let result = 'unknown'
        if (elmtScore !== null && elmtScore !== undefined && 
            opponentScore !== null && opponentScore !== undefined) {
          result = elmtScore > opponentScore ? 'win' : 'loss'
        }
        
        return {
          id: match.id,
          date: match.date,
          opponent: match.opponent,
          result,
          score: (elmtScore !== null && opponentScore !== null) 
            ? `${elmtScore}-${opponentScore}` 
            : null,
          elmtScore,
          opponentScore,
          roomLink: match.faceitLobby,
          faceitRoomId: match.faceitRoomId,
        }
      }),
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('[FaceIt API] Matches error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

