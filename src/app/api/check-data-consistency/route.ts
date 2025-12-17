import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { checkDataConsistency } from '@/utilities/checkDataConsistency'

/**
 * API endpoint to check data consistency
 * 
 * Returns:
 * - Orphaned People (not linked to any team/staff)
 * - Teams with missing person relationships (legacy data)
 * - Duplicate People entries with similar names
 * 
 * Usage: GET /api/check-data-consistency
 * Requires authentication.
 */
export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    
    // Authenticate the request
    const { user } = await payload.auth({ headers: requestHeaders })
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 403 }
      )
    }
    
    const report = await checkDataConsistency(payload)
    
    return NextResponse.json({
      success: true,
      data: report,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check data consistency'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}
