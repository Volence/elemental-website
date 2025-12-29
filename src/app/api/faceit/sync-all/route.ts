import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncTeamData } from '@/utilities/faceitSync'

/**
 * Bulk sync all FaceIt-enabled teams
 * POST /api/faceit/sync-all
 */
export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config: await configPromise })
    
    // Optional: filter by specific league
    const { leagueId } = await request.json().catch(() => ({}))
    
    // Find all teams with FaceIt enabled and an active league
    const whereClause: any = {
      and: [
        { faceitEnabled: { equals: true } },
        { currentFaceitLeague: { exists: true } },
        { faceitTeamId: { exists: true } },
      ],
    }
    
    // If specific league requested, filter by that
    if (leagueId) {
      whereClause.and.push({ currentFaceitLeague: { equals: leagueId } })
    }
    
    const teams = await payload.find({
      collection: 'teams',
      where: whereClause,
      depth: 2, // Populate currentFaceitLeague
      limit: 100,
    })
    
    console.log(`[FaceIt Bulk Sync] Found ${teams.docs.length} teams to sync`)
    
    if (teams.docs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No teams found to sync',
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          matchesCreated: 0,
          matchesUpdated: 0,
        },
      })
    }
    
    const results = []
    let totalMatchesCreated = 0
    let totalMatchesUpdated = 0
    let successCount = 0
    let failCount = 0
    
    // Sync each team with a delay to avoid rate limiting
    for (const team of teams.docs) {
      try {
        const league = team.currentFaceitLeague as any
        
        if (!league || !league.championshipId || !league.stageId) {
          console.warn(`[FaceIt Bulk Sync] Team ${team.name} has incomplete league data, skipping`)
          results.push({
            teamId: team.id,
            teamName: team.name,
            success: false,
            error: 'Incomplete league data',
          })
          failCount++
          continue
        }
        
        console.log(`[FaceIt Bulk Sync] Syncing team: ${team.name}`)
        
        const syncResult = await syncTeamData(
          team.id,
          team.faceitTeamId,
          league.championshipId || '',
          league.leagueId,
          league.seasonId,
          league.stageId
        )
        
        if (syncResult.success) {
          successCount++
          totalMatchesCreated += syncResult.matchesCreated || 0
          totalMatchesUpdated += syncResult.matchesUpdated || 0
          
          results.push({
            teamId: team.id,
            teamName: team.name,
            success: true,
            matchesCreated: syncResult.matchesCreated || 0,
            matchesUpdated: syncResult.matchesUpdated || 0,
          })
        } else {
          failCount++
          results.push({
            teamId: team.id,
            teamName: team.name,
            success: false,
            error: syncResult.error || 'Unknown error',
          })
        }
        
        // Add delay between syncs to avoid rate limiting (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error: any) {
        console.error(`[FaceIt Bulk Sync] Error syncing team ${team.name}:`, error)
        failCount++
        results.push({
          teamId: team.id,
          teamName: team.name,
          success: false,
          error: error.message || 'Sync failed',
        })
      }
    }
    
    const summary = {
      total: teams.docs.length,
      successful: successCount,
      failed: failCount,
      matchesCreated: totalMatchesCreated,
      matchesUpdated: totalMatchesUpdated,
    }
    
    console.log(`[FaceIt Bulk Sync] Complete:`, summary)
    
    return NextResponse.json({
      success: true,
      results,
      summary,
    })
    
  } catch (error: any) {
    console.error('[FaceIt Bulk Sync] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          matchesCreated: 0,
          matchesUpdated: 0,
        },
      },
      { status: 500 }
    )
  }
}


