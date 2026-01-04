import { NextRequest, NextResponse } from 'next/server'
import { postOrUpdateTeamCard, refreshAllTeamCards } from '@/discord/services/teamCards'

/**
 * POST /api/discord/team-cards
 * Refresh team cards in Discord
 *
 * Body options:
 * - { teamId: string | number } - Update single team card
 * - { refreshAll: true } - Refresh all team cards in order
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Refresh all team cards
    if (body.refreshAll) {
      await refreshAllTeamCards()
      return NextResponse.json({
        success: true,
        message: 'All team cards refreshed successfully',
      })
    }

    // Update single team card
    if (body.teamId) {
      const messageId = await postOrUpdateTeamCard({
        teamId: body.teamId,
        forceRepost: body.forceRepost || false,
      })

      if (messageId) {
        return NextResponse.json({
          success: true,
          message: 'Team card updated successfully',
          messageId,
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update team card',
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Missing teamId or refreshAll parameter',
      },
      { status: 400 },
    )
  } catch (error) {
    console.error('Error in team-cards API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    )
  }
}
