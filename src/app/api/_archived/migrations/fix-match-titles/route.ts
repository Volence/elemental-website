import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'

/**
 * API endpoint to update all match titles to include team names
 * This fixes matches that were created before the auto-title generation was implemented
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    
    // Fetch all matches
    const matches = await payload.find({
      collection: 'matches',
      limit: 1000,
      depth: 1, // Include team relationship
    })
    
    let updatedCount = 0
    const errors: string[] = []
    
    // Update each match title
    for (const match of matches.docs) {
      try {
        const teamName = typeof match.team === 'object' && match.team !== null 
          ? match.team.name 
          : ''
        const opponent = match.opponent || 'TBD'
        
        let newTitle = ''
        
        if (teamName && opponent !== 'TBD') {
          newTitle = `ELMT ${teamName} vs ${opponent}`
        } else if (teamName) {
          newTitle = `ELMT ${teamName} vs TBD`
        } else if (opponent !== 'TBD') {
          newTitle = `ELMT vs ${opponent}`
        } else {
          newTitle = 'ELMT Match'
        }
        
        // Only update if title has changed
        if (match.title !== newTitle) {
          await payload.update({
            collection: 'matches',
            id: match.id,
            data: {
              title: newTitle,
            },
          })
          updatedCount++
        }
      } catch (error) {
        errors.push(`Failed to update match ${match.id}: ${error}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} match titles`,
      totalMatches: matches.docs.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error fixing match titles:', error)
    return NextResponse.json(
      { error: 'Failed to fix match titles', details: error },
      { status: 500 }
    )
  }
}
