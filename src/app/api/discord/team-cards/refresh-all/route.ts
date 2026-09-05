import { NextResponse } from 'next/server'
import { authenticateWithAccess, requireAdminAccess } from '@/utilities/apiAuth'

/**
 * POST /api/discord/team-cards/refresh-all
 *
 * Full refresh: Deletes ALL team cards from the Discord channel and reposts
 * them in sorted order (by region, division, SR).
 *
 * This is a destructive operation that ensures cards are in the correct order.
 */
export async function POST(request: Request) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const adminCheck = requireAdminAccess(auth.data.access)
  if (adminCheck) return adminCheck

  try {
    // Import and call the refresh function
    const { refreshAllTeamCards } = await import('@/discord/services/teamCards')
    await refreshAllTeamCards()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Full refresh completed. All cards deleted and reposted in order.' 
    })
  } catch (error: any) {
    console.error('[API] Error in refresh-all:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to refresh team cards' 
    }, { status: 500 })
  }
}
