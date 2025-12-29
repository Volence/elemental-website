import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncTeamData } from '@/utilities/faceitSync'

/**
 * Full Sync Cron Job
 * POST /api/cron/full-sync
 * 
 * Runs once daily at 3 AM:
 * - Syncs ALL active FaceIt-enabled teams
 * - Catches reschedules, new matches, any missed updates
 * - Should be run during low-traffic hours
 * 
 * Requires: x-cron-secret header matching CRON_SECRET env var
 */
export async function POST(request: Request) {
  try {
    // Authenticate cron request
    const cronSecret = request.headers.get('x-cron-secret')
    
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      console.error('[Full Sync] Unauthorized: Invalid or missing cron secret')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('[Full Sync] Starting full sync cron job...')
    
    const payload = await getPayload({ config: await configPromise })
    const now = new Date()
    
    // Find all teams with FaceIt enabled and an active league
    const teams = await payload.find({
      collection: 'teams',
      where: {
        and: [
          { faceitEnabled: { equals: true } },
          { currentFaceitLeague: { exists: true } },
          { faceitTeamId: { exists: true } },
        ],
      },
      depth: 2, // Populate currentFaceitLeague
      limit: 100,
    })
    
    console.log(`[Full Sync] Found ${teams.docs.length} FaceIt-enabled teams to sync`)
    
    if (teams.docs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No FaceIt-enabled teams found',
        teamsTotal: 0,
        apiCalls: 0,
      })
    }
    
    const results = []
    let successCount = 0
    let failCount = 0
    let totalMatchesCreated = 0
    let totalMatchesUpdated = 0
    
    // Sync each team
    for (const team of teams.docs) {
      try {
        const league = team.currentFaceitLeague as any
        
        if (!league || !league.championshipId || !league.stageId) {
          console.warn(`[Full Sync] Team ${team.name} has incomplete league data, skipping`)
          results.push({
            teamId: team.id,
            teamName: team.name,
            success: false,
            error: 'Incomplete league data',
          })
          failCount++
          continue
        }
        
        console.log(`[Full Sync] Syncing team: ${team.name}`)
        
        const syncResult = await syncTeamData(
          team.id,
          team.faceitTeamId,
          league.championshipId || '',
          league.leagueId || '',
          league.seasonId || '',
          league.stageId || ''
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
        
        // Rate limiting: 1 second delay between syncs
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error: any) {
        console.error(`[Full Sync] Error syncing team ${team.name}:`, error)
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
      success: true,
      teamsTotal: teams.docs.length,
      apiCalls: successCount + failCount,
      syncResults: {
        successful: successCount,
        failed: failCount,
      },
      matchStats: {
        created: totalMatchesCreated,
        updated: totalMatchesUpdated,
      },
      timestamp: now.toISOString(),
    }
    
    console.log('[Full Sync] Completed:', summary)
    
    return NextResponse.json(summary)
    
  } catch (error: any) {
    console.error('[Full Sync] Fatal error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

