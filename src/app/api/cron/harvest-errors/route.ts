import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { startCronJob, completeCronJob, failCronJob } from '@/utilities/cronLogger'

/**
 * Error Stats Cron Job
 * 
 * This job aggregates error statistics from the error-logs collection
 * and updates the error dashboard with summary information.
 * 
 * Schedule: Run every 5 minutes
 * 
 * Note: Actual errors are captured by the global error handler in instrumentation.ts
 * and logged directly to the error-logs collection. This cron just aggregates stats.
 */

export async function POST(request: NextRequest) {
  let cronJobRunId: number | string | undefined
  
  try {
    // Authenticate the request
    const cronSecret = request.headers.get('x-cron-secret')
    const authHeader = request.headers.get('authorization')
    
    const isAuthorized = 
      cronSecret === process.env.CRON_SECRET ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = await getPayload({ config: await configPromise })
    
    // Start tracking this cron job run
    cronJobRunId = await startCronJob(payload, 'error-harvester')

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Get error counts for different time periods
    const [last24Hours, lastHour, unresolvedErrors] = await Promise.all([
      payload.count({
        collection: 'error-logs',
        where: {
          createdAt: { greater_than: oneDayAgo.toISOString() },
        },
      }),
      payload.count({
        collection: 'error-logs',
        where: {
          createdAt: { greater_than: oneHourAgo.toISOString() },
        },
      }),
      payload.count({
        collection: 'error-logs',
        where: {
          resolved: { equals: false },
        },
      }),
    ])

    // Get breakdown by severity for unresolved errors
    const [criticalCount, highCount, mediumCount, lowCount] = await Promise.all([
      payload.count({
        collection: 'error-logs',
        where: {
          and: [
            { resolved: { equals: false } },
            { severity: { equals: 'critical' } },
          ],
        },
      }),
      payload.count({
        collection: 'error-logs',
        where: {
          and: [
            { resolved: { equals: false } },
            { severity: { equals: 'high' } },
          ],
        },
      }),
      payload.count({
        collection: 'error-logs',
        where: {
          and: [
            { resolved: { equals: false } },
            { severity: { equals: 'medium' } },
          ],
        },
      }),
      payload.count({
        collection: 'error-logs',
        where: {
          and: [
            { resolved: { equals: false } },
            { severity: { equals: 'low' } },
          ],
        },
      }),
    ])

    // Get most recent errors for quick review
    const recentErrors = await payload.find({
      collection: 'error-logs',
      where: {
        resolved: { equals: false },
      },
      sort: '-createdAt',
      limit: 5,
    })

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      stats: {
        last24Hours: last24Hours.totalDocs,
        lastHour: lastHour.totalDocs,
        unresolved: unresolvedErrors.totalDocs,
      },
      bySeverity: {
        critical: criticalCount.totalDocs,
        high: highCount.totalDocs,
        medium: mediumCount.totalDocs,
        low: lowCount.totalDocs,
      },
      recentErrors: recentErrors.docs.map(e => ({
        id: e.id,
        message: e.message?.substring(0, 100) + (e.message && e.message.length > 100 ? '...' : ''),
        severity: e.severity,
        errorType: e.errorType,
        createdAt: e.createdAt,
      })),
    }

    // Mark cron job as completed
    if (cronJobRunId) {
      await completeCronJob(payload, cronJobRunId, summary)
    }

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('[Error Stats] Failed:', error)
    
    // Mark cron job as failed
    if (cronJobRunId) {
      const payload = await getPayload({ config: await configPromise })
      await failCronJob(payload, cronJobRunId, error.message || 'Failed to aggregate error stats')
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to aggregate error stats',
      },
      { status: 500 }
    )
  }
}
