import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/faceit/lookup-championship?stageId=...&seasonId=...&conferenceId=...
 * 
 * Looks up the FACEIT Championship ID using the Season Tree API.
 * The championship_id lives on each conference within the stage→conference hierarchy.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stageId')
  const seasonId = searchParams.get('seasonId')
  const conferenceId = searchParams.get('conferenceId')

  if (!seasonId) {
    return NextResponse.json(
      { error: 'seasonId is required' },
      { status: 400 }
    )
  }

  try {
    // The seasons/tree API returns the full league hierarchy including championship_id on each conference
    const response = await fetch(
      `https://www.faceit.com/api/team-leagues/v2/seasons/tree?entityType=season&entityId=${seasonId}`,
      { next: { revalidate: 0 } }
    )

    if (!response.ok) {
      console.error(`[Championship Lookup] FACEIT API returned ${response.status} for season ${seasonId}`)
      return NextResponse.json(
        { error: `FACEIT API returned ${response.status}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    const payload = data?.payload

    if (!payload?.regions) {
      return NextResponse.json(
        { error: 'Unexpected API response structure', championshipId: null },
        { status: 404 }
      )
    }

    // Walk the tree: regions → divisions → stages → conferences
    // Find the matching conference (by stageId + conferenceId) to extract championship_id
    for (const region of payload.regions) {
      for (const division of region.divisions || []) {
        for (const stage of division.stages || []) {
          // If stageId is provided, only look in the matching stage
          if (stageId && stage.id !== stageId) continue

          for (const conference of stage.conferences || []) {
            // If conferenceId is provided, match it; otherwise take the first conference
            if (conferenceId && conference.id !== conferenceId) continue

            if (conference.championship_id) {
              return NextResponse.json({
                championshipId: conference.championship_id,
                conferenceName: conference.name,
                stageName: stage.name,
                divisionName: division.name,
                regionName: region.name,
              })
            }
          }

          // If we matched the stage but no conference had a championship_id
          if (stageId && stage.id === stageId) {
            // Try the first conference as fallback
            const firstConference = stage.conferences?.[0]
            if (firstConference?.championship_id) {
              return NextResponse.json({
                championshipId: firstConference.championship_id,
                conferenceName: firstConference.name,
                stageName: stage.name,
                divisionName: division.name,
                regionName: region.name,
              })
            }
          }
        }
      }
    }

    // Championship ID not found
    return NextResponse.json(
      { error: 'Championship ID not found in season tree. Try checking the Network tab in DevTools for API calls containing "championship" in the response.', championshipId: null },
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
