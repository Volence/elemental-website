import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/faceit/lookup-championship?stageId=...
 * 
 * Looks up the FACEIT Championship ID using the Stage ID.
 * Uses the unauthenticated internal FACEIT API (same as faceitSync.ts).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stageId')

  if (!stageId) {
    return NextResponse.json(
      { error: 'stageId is required' },
      { status: 400 }
    )
  }

  try {
    // The FACEIT team-leagues API returns stage details including the championship ID
    // This is unauthenticated — same API used by faceitSync.ts
    const response = await fetch(
      `https://www.faceit.com/api/team-leagues/v2/seasons?entityType=stage&entityId=${stageId}`,
      { next: { revalidate: 0 } }
    )

    if (!response.ok) {
      console.error(`[Championship Lookup] FACEIT API returned ${response.status} for stage ${stageId}`)
      return NextResponse.json(
        { error: `FACEIT API returned ${response.status}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    
    // The response payload contains championship info
    // Try multiple paths to find the championship ID
    const championshipId = 
      data?.payload?.championshipId ||
      data?.payload?.championship_id ||
      data?.payload?.id ||
      null

    if (championshipId) {
      return NextResponse.json({ championshipId })
    }

    // If the direct lookup didn't work, try the standings endpoint
    // which may have championship context in match data
    const standingsResponse = await fetch(
      `https://www.faceit.com/api/team-leagues/v2/standings?entityType=stage&entityId=${stageId}&offset=0&limit=1`
    )

    if (standingsResponse.ok) {
      const standingsData = await standingsResponse.json()
      const standings = standingsData?.payload?.standings || []
      
      if (standings.length > 0) {
        // If we can find a team in the standings, try to get their matches
        // which contain the championship ID
        const teamId = standings[0]?.premade_team_id
        if (teamId) {
          const matchesResponse = await fetch(
            `https://www.faceit.com/api/team-leagues/v2/teams/${teamId}/stages/${stageId}`
          )
          
          if (matchesResponse.ok) {
            const matchesData = await matchesResponse.json()
            const foundChampionshipId = 
              matchesData?.payload?.championshipId ||
              matchesData?.payload?.championship_id ||
              null
            
            if (foundChampionshipId) {
              return NextResponse.json({ championshipId: foundChampionshipId })
            }
          }
        }
      }
    }

    // Championship ID not found through any method
    return NextResponse.json(
      { error: 'Championship ID not found for this stage', championshipId: null },
      { status: 404 }
    )

  } catch (error: any) {
    console.error('[Championship Lookup] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to lookup championship ID' },
      { status: 500 }
    )
  }
}
