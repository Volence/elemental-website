import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const maxDuration = 60

/**
 * Manual sync utility to ensure teams' activeTournaments matches tournaments' assignedTeams
 * This is useful if teams were bulk-assigned before the automatic sync hook was added
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    // Authenticate user
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user || (user.role !== 'admin' && user.role !== 'staff-manager')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get all tournament templates
    const tournaments = await payload.find({
      collection: 'tournament-templates',
      depth: 0,
      limit: 1000,
    })

    let syncedCount = 0

    // For each tournament, sync its assigned teams
    for (const tournament of tournaments.docs) {
      const assignedTeamIds = (tournament.assignedTeams || []).map((t: any) => 
        typeof t === 'number' ? t : t.id
      )

      for (const teamId of assignedTeamIds) {
        try {
          const team = await payload.findByID({
            collection: 'teams',
            id: teamId,
            depth: 0,
          })
          
          const currentTournaments = team.activeTournaments || []
          const tournamentIds = currentTournaments.map((t: any) => 
            typeof t === 'number' ? t : t.id
          )
          
          // If team doesn't have this tournament in activeTournaments, add it
          if (!tournamentIds.includes(tournament.id)) {
            await payload.update({
              collection: 'teams',
              id: teamId,
              data: {
                activeTournaments: [...tournamentIds, tournament.id],
              },
            })
            syncedCount++
          }
        } catch (error) {
          console.error(`Failed to sync team ${teamId}:`, error)
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Synced ${syncedCount} team-tournament relationships`,
      syncedCount,
    })
  } catch (error: any) {
    console.error('Error syncing tournament teams:', error)
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}

