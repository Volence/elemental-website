import { NextResponse } from 'next/server'
import { authenticateWithAccess, requireAdminAccess } from '@/utilities/apiAuth'

/**
 * POST /api/discord/team-cards/update-all
 *
 * Soft refresh: Updates each team card in-place without deleting.
 * Only reposts if the original message is missing.
 *
 * This is a safe operation that preserves card positions when possible.
 */
export async function POST(request: Request) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const adminCheck = requireAdminAccess(auth.data.access)
  if (adminCheck) return adminCheck

  try {
    const { payload } = auth.data

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
    
    
    return NextResponse.json({
      success: failed === 0,
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
