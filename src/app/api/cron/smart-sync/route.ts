import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncTeamData } from '@/utilities/faceitSync'
import { startCronJob, completeCronJob, failCronJob } from '@/utilities/cronLogger'

/**
 * Smart Sync Cron Job
 * POST /api/cron/smart-sync
 * 
 * Runs every 3 hours:
 * 1. Finds all "scheduled" matches that are 2+ hours old
 * 2. Marks them as "complete"
 * 3. If any were completed, syncs ONLY those teams from FaceIt API
 * 4. If none, does nothing (0 API calls)
 * 
 * Requires: x-cron-secret header matching CRON_SECRET env var
 */
export async function POST(request: Request) {
  let cronJobRunId: number | string | undefined
  
  try {
    // Authenticate cron request
    const cronSecret = request.headers.get('x-cron-secret')
    
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      console.error('[Smart Sync] Unauthorized: Invalid or missing cron secret')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('[Smart Sync] Starting smart sync cron job...')
    
    const payload = await getPayload({ config: await configPromise })
    
    // Start tracking this cron job run
    cronJobRunId = await startCronJob(payload, 'smart-sync')
    
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    
    // Step 1: Find all scheduled matches that are 2+ hours old
    const oldScheduledMatches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { status: { equals: 'scheduled' } },
          { date: { less_than: twoHoursAgo.toISOString() } },
        ],
      },
      limit: 100, // Safety limit
      depth: 2, // Get team data
    })
    
    console.log(`[Smart Sync] Found ${oldScheduledMatches.docs.length} old scheduled matches`)
    
    if (oldScheduledMatches.docs.length === 0) {
      console.log('[Smart Sync] No old matches found. Skipping sync.')
      
      const summary = {
        success: true,
        message: 'No old matches found',
        matchesCompleted: 0,
        teamsToSync: 0,
        apiCalls: 0,
      }
      
      // Mark cron job as completed even when no work was done
      if (cronJobRunId) {
        await completeCronJob(payload, cronJobRunId, summary)
      }
      
      return NextResponse.json(summary)
    }
    
    // Step 2: Mark them as complete and collect unique team IDs
    const teamIdsToSync = new Set<number>()
    const completedMatchIds: number[] = []
    
    for (const match of oldScheduledMatches.docs) {
      try {
        // Update match status to complete
        await payload.update({
          collection: 'matches',
          id: match.id,
          data: {
            status: 'complete',
          },
        })
        
        completedMatchIds.push(match.id)
        
        // Track team ID for sync
        const teamId = typeof match.team === 'number' ? match.team : match.team?.id
        if (teamId) {
          teamIdsToSync.add(teamId)
        }
        
        console.log(`[Smart Sync] Marked match ${match.id} (${match.title}) as complete`)
      } catch (error: any) {
        console.error(`[Smart Sync] Error marking match ${match.id} as complete:`, error.message)
      }
    }
    
    console.log(`[Smart Sync] Marked ${completedMatchIds.length} matches as complete`)
    console.log(`[Smart Sync] ${teamIdsToSync.size} unique teams need syncing`)
    
    if (teamIdsToSync.size === 0) {
      const summary = {
        success: true,
        message: 'Matches marked complete but no teams to sync',
        matchesCompleted: completedMatchIds.length,
        teamsToSync: 0,
        apiCalls: 0,
      }
      
      // Mark cron job as completed
      if (cronJobRunId) {
        await completeCronJob(payload, cronJobRunId, summary)
      }
      
      return NextResponse.json(summary)
    }
    
    // Step 3: Sync only the teams that had completed matches
    const syncResults = []
    let successCount = 0
    let failCount = 0
    
    for (const teamId of teamIdsToSync) {
      try {
        // Get team's FaceIt data
        const team = await payload.findByID({
          collection: 'teams',
          id: teamId,
          depth: 1,
        })
        
        if (!team.faceitEnabled || !team.currentFaceitLeague || !team.faceitTeamId) {
          console.warn(`[Smart Sync] Team ${team.name} (${teamId}) is not FaceIt-enabled or missing data, skipping`)
          continue
        }
        
        const league = team.currentFaceitLeague as any
        
        if (!league || !league.championshipId || !league.stageId) {
          console.warn(`[Smart Sync] Team ${team.name} has incomplete league data, skipping`)
          continue
        }
        
        console.log(`[Smart Sync] Syncing team: ${team.name}`)
        
        const syncResult = await syncTeamData(
          team.id,
          team.faceitTeamId,
          league.championshipId,
          league.leagueId,
          league.seasonId,
          league.stageId
        )
        
        if (syncResult.success) {
          successCount++
          syncResults.push({
            teamId: team.id,
            teamName: team.name,
            success: true,
          })
        } else {
          failCount++
          syncResults.push({
            teamId: team.id,
            teamName: team.name,
            success: false,
            error: syncResult.error,
          })
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error: any) {
        console.error(`[Smart Sync] Error syncing team ${teamId}:`, error.message)
        failCount++
        syncResults.push({
          teamId,
          success: false,
          error: error.message,
        })
      }
    }
    
    // Determine if the job was successful overall
    // Consider it a failure if ALL teams failed to sync (when there were teams to sync)
    const overallSuccess = teamIdsToSync.size === 0 || successCount > 0
    
    const summary = {
      success: overallSuccess,
      matchesCompleted: completedMatchIds.length,
      teamsToSync: teamIdsToSync.size,
      apiCalls: successCount + failCount,
      syncResults: {
        successful: successCount,
        failed: failCount,
      },
      timestamp: now.toISOString(),
      results: syncResults, // Include individual team results for debugging
    }
    
    console.log('[Smart Sync] Completed:', summary)
    
    // Mark cron job as completed or failed based on overall success
    if (cronJobRunId) {
      if (overallSuccess) {
        await completeCronJob(payload, cronJobRunId, summary)
      } else {
        const errorMsg = `${failCount} of ${teamIdsToSync.size} teams failed to sync`
        await failCronJob(payload, cronJobRunId, errorMsg)
      }
    }
    
    return NextResponse.json(summary)
    
  } catch (error: any) {
    console.error('[Smart Sync] Fatal error:', error)
    
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

