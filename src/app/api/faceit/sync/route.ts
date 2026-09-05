import { NextResponse } from 'next/server'
import { syncAllTeams } from '@/utilities/faceitSync'
import { authenticateWithAccess, requireStaffManagerAccess } from '@/utilities/apiAuth'

/**
 * POST /api/faceit/sync
 * 
 * Sync all teams with FaceIt enabled.
 * Requires admin authentication or cron secret.
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-cron-secret')
    
    // Allow if cron secret matches (for automated jobs)
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      // Authenticated via cron secret
    } else {
      // Verify staff-manager-or-above authentication via the resolver
      const auth = await authenticateWithAccess()
      if (!auth.success) return auth.response
      const staffCheck = requireStaffManagerAccess(auth.data.access)
      if (staffCheck) return staffCheck
    }
    
    // Run sync
    const results = await syncAllTeams()
    
    // Aggregate results
    const summary = {
      success: true,
      syncedTeams: results.filter(r => r.success).length,
      matchesCreated: results.reduce((sum, r) => sum + (r.matchesCreated || 0), 0),
      matchesUpdated: results.reduce((sum, r) => sum + (r.matchesUpdated || 0), 0),
      errors: results.filter(r => !r.success).map(r => r.error),
    }
    
    
    return NextResponse.json(summary)
    
  } catch (error: any) {
    console.error('[FaceIt API] Sync error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

