import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * POST /api/discord/team-cards/refresh-all
 * 
 * Full refresh: Deletes ALL team cards from the Discord channel and reposts
 * them in sorted order (by region, division, SR).
 * 
 * This is a destructive operation that ensures cards are in the correct order.
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const payload = await getPayload({ config: configPromise })
    
    // Get auth from cookies
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Simple auth check - verify user is admin
    // The actual user verification happens through payload's auth system
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
