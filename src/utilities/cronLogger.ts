import type { Payload } from 'payload'

/**
 * Cron Job Logger Utility
 * 
 * Provides functions to track cron job execution for monitoring.
 */

export type CronJobName = 'smart-sync' | 'full-sync' | 'session-cleanup' | 'error-harvester'
export type CronJobStatus = 'running' | 'success' | 'failed'

/**
 * Start tracking a cron job run
 * 
 * @param payload - Payload instance
 * @param jobName - Name of the cron job
 * @returns The ID of the created cron job run record
 */
export async function startCronJob(
  payload: Payload,
  jobName: CronJobName,
): Promise<number | string> {
  try {
    const cronJobRun = await payload.create({
      collection: 'cron-job-runs',
      data: {
        jobName,
        status: 'running',
        startTime: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    return cronJobRun.id
  } catch (error) {
    console.error('[Cron Logger] Failed to start cron job tracking:', error)
    throw error
  }
}

/**
 * Complete a cron job run with success
 * 
 * @param payload - Payload instance
 * @param cronJobRunId - ID of the cron job run record
 * @param summary - Job-specific results
 */
export async function completeCronJob(
  payload: Payload,
  cronJobRunId: number | string,
  summary?: Record<string, any>,
): Promise<void> {
  try {
    const endTime = new Date()
    
    // Fetch the start time to calculate duration
    const cronJobRun = await payload.findByID({
      collection: 'cron-job-runs',
      id: cronJobRunId,
      overrideAccess: true,
    })

    const startTime = new Date(cronJobRun.startTime)
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000)

    await payload.update({
      collection: 'cron-job-runs',
      id: cronJobRunId,
      data: {
        status: 'success',
        endTime: endTime.toISOString(),
        duration,
        summary,
      },
      overrideAccess: true,
    })
  } catch (error) {
    console.error('[Cron Logger] Failed to complete cron job tracking:', error)
  }
}

/**
 * Mark a cron job run as failed
 * 
 * @param payload - Payload instance
 * @param cronJobRunId - ID of the cron job run record
 * @param errorMessage - Error message or details
 */
export async function failCronJob(
  payload: Payload,
  cronJobRunId: number | string,
  errorMessage: string,
): Promise<void> {
  try {
    const endTime = new Date()
    
    // Fetch the start time to calculate duration
    const cronJobRun = await payload.findByID({
      collection: 'cron-job-runs',
      id: cronJobRunId,
      overrideAccess: true,
    })

    const startTime = new Date(cronJobRun.startTime)
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000)

    await payload.update({
      collection: 'cron-job-runs',
      id: cronJobRunId,
      data: {
        status: 'failed',
        endTime: endTime.toISOString(),
        duration,
        errors: errorMessage,
      },
      overrideAccess: true,
    })
  } catch (error) {
    console.error('[Cron Logger] Failed to mark cron job as failed:', error)
  }
}


