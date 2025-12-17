import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Fetch Dragon team with depth 2 (same as getTeamBySlug)
    const result = await payload.find({
      collection: 'teams',
      where: { slug: { equals: 'dragon' } },
      depth: 2,
      limit: 1,
    })
    
    if (!result.docs[0]) {
      return NextResponse.json({ error: 'Dragon team not found' }, { status: 404 })
    }
    
    const team = result.docs[0]
    
    // Log the raw roster data
    const rosterDebug = team.roster?.map(player => ({
      role: player.role,
      personType: typeof player.person,
      personId: typeof player.person === 'object' ? player.person?.id : player.person,
      personName: typeof player.person === 'object' ? player.person?.name : 'NOT POPULATED',
      personSlug: typeof player.person === 'object' ? player.person?.slug : 'NOT POPULATED',
    }))
    
    return NextResponse.json({
      teamId: team.id,
      teamName: team.name,
      rosterCount: team.roster?.length || 0,
      roster: rosterDebug,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
