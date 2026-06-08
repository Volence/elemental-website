import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'

/** GET /api/discord/server/clone-status?jobId=... — current job state for polling. */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 })
  }

  try {
    const { payload } = auth.data
    const job = await payload.findByID({ collection: 'discord-clone-jobs', id: jobId })
    return NextResponse.json({
      success: true,
      status: job.status,
      progress: job.progress,
      report: job.report,
      error: job.error,
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }
}
