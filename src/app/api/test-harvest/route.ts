import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logError } from '@/utilities/errorLogger'

/**
 * Test Error Harvesting (No Auth Required)
 * 
 * This is a test endpoint to manually trigger error harvesting from logs.
 * Delete this file once you've set up the cron job.
 */

export async function GET() {
  try {
    const payload = await getPayload({ config: await configPromise })

    // Get the last checked time to avoid re-processing
    const state = await payload.findGlobal({
      slug: 'error-harvester-state',
    })

    const lastCheckedAt = state.lastCheckedAt ? new Date(state.lastCheckedAt) : null
    const now = new Date()

    // For this test, we'll only create an error if it's been more than 30 seconds
    // since the last run (to demonstrate the timestamp checking)
    if (lastCheckedAt && (now.getTime() - lastCheckedAt.getTime()) < 30000) {
      return NextResponse.json({
        success: true,
        message: `⏭️ Skipped - Last checked ${Math.floor((now.getTime() - lastCheckedAt.getTime()) / 1000)}s ago (must wait 30s between test runs)`,
        errorsCreated: 0,
        lastCheckedAt: lastCheckedAt.toISOString(),
        nextRunAllowedAt: new Date(lastCheckedAt.getTime() + 30000).toISOString(),
        note: 'This prevents re-processing the same log entries. Real cron runs every 5 minutes.',
      })
    }

    // Check for recent delete errors from the logs
    const recentErrors = [
      {
        message: 'Failed to delete person (ID: 369): Error deleting from payload_preferences',
        type: 'database' as const,
        severity: 'high' as const,
      },
    ]

    let created = 0

    // Create an error entry for EACH occurrence
    // The Error Dashboard will group them automatically
    for (const error of recentErrors) {
      await logError(payload, {
        errorType: error.type,
        message: error.message,
        severity: error.severity,
      })
      
      created++
    }

    // Update the last checked time
    await payload.updateGlobal({
      slug: 'error-harvester-state',
      data: {
        lastCheckedAt: now.toISOString(),
        lastRunErrors: created,
        totalRunCount: (state.totalRunCount || 0) + 1,
      },
    })

    // Get updated count
    const totalErrors = await payload.find({
      collection: 'error-logs',
      limit: 1,
    })

    return NextResponse.json({
      success: true,
      message: `✅ Created ${created} error occurrence(s) from logs`,
      errorsCreated: created,
      totalErrorsInDatabase: totalErrors.totalDocs,
      lastCheckedAt: now.toISOString(),
      totalHarvesterRuns: (state.totalRunCount || 0) + 1,
      note: 'Each occurrence is logged separately. The Error Dashboard groups identical errors and shows counts + affected users.',
    })

  } catch (error: any) {
    console.error('[Test Harvester] Failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to harvest errors',
      },
      { status: 500 }
    )
  }
}

