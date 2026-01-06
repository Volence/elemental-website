import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * POST /api/discord/team-cards/update-all
 * 
 * Soft refresh: Updates each team card in-place without deleting.
 * Only reposts if the original message is missing.
 * 
 * This is a safe operation that preserves card positions when possible.
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const payload = await getPayload({ config: configPromise })
    
    // Get auth from cookies
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Simple auth check - verify user is admin
    const authResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/api/users/me`, {
      headers: {
        'Cookie': cookieHeader,
      },
    })
    
    if (!authResponse.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userData = await authResponse.json()
    if (userData.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.log(`[API] Soft refresh triggered by ${userData.user.email}`)
    
    // Fetch all teams
    const teams = await payload.find({
      collection: 'teams',
      limit: 1000,
    })
    
    // Import the update function
    const { postOrUpdateTeamCard } = await import('@/discord/services/teamCards')
    
    let updated = 0
    let failed = 0
    const errors: string[] = []
    
    // Update each team's card
    for (const team of teams.docs) {
      try {
        const result = await postOrUpdateTeamCard({ teamId: team.id })
        if (result) {
          updated++
        } else {
          failed++
          errors.push(`${team.name}: Failed to update`)
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error: any) {
        failed++
        errors.push(`${team.name}: ${error.message}`)
      }
    }
    
    console.log(`[API] Soft refresh complete: ${updated} updated, ${failed} failed`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updated} cards, ${failed} failed`,
      stats: {
        total: teams.docs.length,
        updated,
        failed,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[API] Error in update-all:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to update team cards' 
    }, { status: 500 })
  }
}
