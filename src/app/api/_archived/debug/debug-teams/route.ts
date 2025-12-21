import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Debug endpoint to check team data and person relationships
 * Usage: GET /api/debug-teams
 */
export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Fetch teams with different depths
    const teamsDepth1 = await payload.find({
      collection: 'teams',
      limit: 5,
      depth: 1,
    })
    
    const teamsDepth2 = await payload.find({
      collection: 'teams',
      limit: 5,
      depth: 2,
    })
    
    // Sample first team's manager data
    const sampleTeam = teamsDepth2.docs[0]
    
    return NextResponse.json({
      totalTeams: teamsDepth2.docs.length,
      sampleTeam: sampleTeam ? {
        name: sampleTeam.name,
        slug: sampleTeam.slug,
        managerCount: sampleTeam.manager?.length || 0,
        coachesCount: sampleTeam.coaches?.length || 0,
        captainCount: sampleTeam.captain?.length || 0,
        firstManager: sampleTeam.manager?.[0] ? {
          hasPerson: !!sampleTeam.manager[0].person,
          personType: typeof sampleTeam.manager[0].person,
          personIsPopulated: typeof sampleTeam.manager[0].person === 'object' && 
                            sampleTeam.manager[0].person !== null && 
                            'name' in sampleTeam.manager[0].person,
          personId: typeof sampleTeam.manager[0].person === 'object' && 
                   sampleTeam.manager[0].person !== null 
                   ? (sampleTeam.manager[0].person as any).id 
                   : sampleTeam.manager[0].person,
          personName: typeof sampleTeam.manager[0].person === 'object' && 
                     sampleTeam.manager[0].person !== null && 
                     'name' in sampleTeam.manager[0].person
                     ? (sampleTeam.manager[0].person as any).name 
                     : null,
        } : null,
        depth1Manager: teamsDepth1.docs[0]?.manager?.[0] ? {
          hasPerson: !!teamsDepth1.docs[0].manager[0].person,
          personType: typeof teamsDepth1.docs[0].manager[0].person,
          personIsPopulated: typeof teamsDepth1.docs[0].manager[0].person === 'object' && 
                            teamsDepth1.docs[0].manager[0].person !== null && 
                            'name' in teamsDepth1.docs[0].manager[0].person,
        } : null,
      } : null,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
