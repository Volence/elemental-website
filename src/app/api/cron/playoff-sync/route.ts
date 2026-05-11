import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncPlayoffs } from '@/utilities/faceitSync'
import { startCronJob, completeCronJob, failCronJob } from '@/utilities/cronLogger'

let syncInProgress = false

export async function POST(request: Request) {
  let cronJobRunId: number | string | undefined

  try {
    const cronSecret = request.headers.get('x-cron-secret')

    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    if (syncInProgress) {
      return NextResponse.json(
        { success: false, error: 'Playoff sync already in progress' },
        { status: 409 },
      )
    }
    syncInProgress = true

    const payload = await getPayload({ config: await configPromise })
    cronJobRunId = await startCronJob(payload, 'playoff-sync')

    const result = await syncPlayoffs()

    if (cronJobRunId) {
      if (result.success) {
        await completeCronJob(payload, cronJobRunId, result)
      } else {
        await failCronJob(payload, cronJobRunId, result.error || 'Unknown error')
      }
    }

    syncInProgress = false
    return NextResponse.json(result)
  } catch (error: any) {
    syncInProgress = false
    console.error('[Playoff Sync Cron] Fatal error:', error)

    if (cronJobRunId) {
      const payload = await getPayload({ config: await configPromise })
      await failCronJob(payload, cronJobRunId, error.message || 'Internal server error')
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
