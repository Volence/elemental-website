import { NextResponse } from 'next/server'
import { syncTeamData } from '@/utilities/faceitSync'

/**
 * POST /api/faceit/sync/[teamId]
 * 
 * Sync a single team from FaceIt.
 * Used by admin manual sync button.
 */
export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const teamId = parseInt(params.teamId)
    
    if (isNaN(teamId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      )
    }
    
    // Get league IDs from request body
    const body = await request.json()
    const {faceitTeamId, championshipId, leagueId, seasonId, stageId } = body
    
    if (!faceitTeamId || !stageId) {
      return NextResponse.json(
        { success: false, error: 'Missing required FaceIt IDs (faceitTeamId, stageId)' },
        { status: 400 }
      )
    }
    
    // TODO: Check admin authentication
    // For now, we'll allow the request (testing locally)
    
    console.log(`[FaceIt API] Syncing team ${teamId} with FaceIt team ${faceitTeamId}, stage ${stageId}...`)
    
    const result = await syncTeamData(teamId, faceitTeamId, championshipId, leagueId, seasonId, stageId)
    
    if (result.success) {
      console.log(`[FaceIt API] Team ${teamId} synced successfully:`, result)
      return NextResponse.json(result)
    } else {
      console.error(`[FaceIt API] Team ${teamId} sync failed:`, result.error)
      return NextResponse.json(result, { status: 400 })
    }
    
  } catch (error: any) {
    console.error('[FaceIt API] Single team sync error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

