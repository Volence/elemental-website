import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get Dragon team
    const dragonResult = await payload.find({
      collection: 'teams',
      where: { slug: { equals: 'dragon' } },
      depth: 2,
      limit: 1,
    })
    
    if (!dragonResult.docs[0]) {
      return NextResponse.json({ error: 'Dragon team not found' }, { status: 404 })
    }
    
    const dragon = dragonResult.docs[0]
    const rosterInfo: any[] = []
    
    if (dragon.roster && Array.isArray(dragon.roster)) {
      for (const player of dragon.roster) {
        const person = player.person
        if (typeof person === 'object' && person) {
          rosterInfo.push({
            personId: person.id,
            name: person.name,
            slug: person.slug,
            role: player.role,
          })
        } else {
          rosterInfo.push({
            personId: person,
            notPopulated: true,
            role: player.role,
          })
        }
      }
    }
    
    // Check for people with slug-like names
    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      depth: 0,
    })
    
    const slugLikeNames = allPeople.docs
      .filter(p => p.name.includes('-') || p.name === p.name.toLowerCase())
      .map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      }))
    
    return NextResponse.json({
      dragonRoster: rosterInfo,
      peopleWithSlugLikeNames: slugLikeNames,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
