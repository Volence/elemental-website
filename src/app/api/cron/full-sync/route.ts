import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncTeamData } from '@/utilities/faceitSync'
import { startCronJob, completeCronJob, failCronJob } from '@/utilities/cronLogger'

/**
 * Full Sync Cron Job
 * POST /api/cron/full-sync
 * 
 * Runs every 3 hours:
 * - Syncs ALL active FaceIt-enabled teams
 * - Updates match data, team records, standings
 * - Ensures data stays fresh throughout the day
 * 
 * Requires: x-cron-secret header matching CRON_SECRET env var
 */
export async function POST(request: Request) {
  let cronJobRunId: number | string | undefined
  
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
    
    
    const payload = await getPayload({ config: await configPromise })
    
    // Start tracking this cron job run
    cronJobRunId = await startCronJob(payload, 'full-sync')
    
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
    
    
    if (teams.docs.length === 0) {
      const summary = {
        success: true,
        message: 'No FaceIt-enabled teams found',
        teamsTotal: 0,
        apiCalls: 0,
      }
      
      // Mark cron job as completed even when no work was done
      if (cronJobRunId) {
        await completeCronJob(payload, cronJobRunId, summary)
      }
      
      return NextResponse.json(summary)
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
        
        
        const syncResult = await syncTeamData(
          team.id,
          team.faceitTeamId || '',
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
    
    // Determine if the job was successful overall
    // Consider it a failure if ALL teams failed, or if more than 50% failed
    const overallSuccess = successCount > 0 && (successCount >= failCount)
    
    const summary = {
      success: overallSuccess,
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
      results, // Include individual team results for debugging
    }
    
    
    // Mark cron job as completed or failed based on overall success
    if (cronJobRunId) {
      if (overallSuccess) {
        await completeCronJob(payload, cronJobRunId, summary)
      } else {
        const errorMsg = `${failCount} of ${teams.docs.length} teams failed to sync`
        await failCronJob(payload, cronJobRunId, errorMsg)
      }
    }
    
    return NextResponse.json(summary)
    
  } catch (error: any) {
    console.error('[Full Sync] Fatal error:', error)
    
    // Mark cron job as failed
    if (cronJobRunId) {
      const payload = await getPayload({ config: await configPromise })
      await failCronJob(payload, cronJobRunId, error.message || 'Internal server error')
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

