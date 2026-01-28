import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { isAdmin } from '@/access/roles'

/**
 * Backfill team fields for existing matches
 * 
 * This API updates matches that have the legacy `team` field populated
 * but are missing the new `team1Internal` field (introduced for flexible team support).
 * 
 * POST /api/production/backfill-team-fields
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Find all matches where team exists but team1Internal is empty
    const matchesToBackfill = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { team: { exists: true } },
          {
            or: [
              { team1Internal: { exists: false } },
              { team1Internal: { equals: null } },
            ],
          },
        ],
      },
      limit: 500,
      depth: 0,
    })

    let updatedCount = 0
    const errors: string[] = []

    for (const match of matchesToBackfill.docs) {
      try {
        // Get the team ID from the legacy field
        const teamId = typeof match.team === 'object' 
          ? (match.team as any).id 
          : match.team

        if (!teamId) continue

        await payload.update({
          collection: 'matches',
          id: match.id,
          data: {
            team1Type: 'internal',
            team1Internal: teamId,
          },
        })
        updatedCount++
      } catch (err: any) {
        errors.push(`Match ${match.id}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfilled ${updatedCount} matches`,
      totalFound: matchesToBackfill.docs.length,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error: any) {
    console.error('[Backfill Team Fields] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
