import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import teamsData from '@/data/teams.json'

// Preview what will be updated
export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Collect all names from teams.json with proper capitalization
    const properNames = new Map<string, string>() // slug -> proper name
    
    teamsData.teams.forEach(team => {
      // Manager, coaches, captain, roster, subs
      ;[...team.manager || [], ...team.coaches || [], ...team.captain || [], ...team.roster?.map(r => r.name) || [], ...team.subs || []].forEach((name: any) => {
        if (typeof name === 'string' && name) {
          const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
          properNames.set(slug, name)
        }
      })
    })
    
    // Get all people
    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      depth: 0,
    })
    
    const willUpdate: any[] = []
    
    for (const person of allPeople.docs) {
      const properName = person.slug ? properNames.get(person.slug) : undefined
      if (properName && properName !== person.name) {
        willUpdate.push({
          id: person.id,
          currentName: person.name,
          willBecome: properName,
          slug: person.slug,
        })
      }
    }
    
    return NextResponse.json({
      message: 'Preview only - POST to this endpoint to actually update',
      totalProperNames: properNames.size,
      willUpdate: willUpdate.length,
      people: willUpdate,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Actually update the names
export async function POST() {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Collect all names from teams.json with proper capitalization
    const properNames = new Map<string, string>() // slug -> proper name
    
    teamsData.teams.forEach(team => {
      // Manager
      team.manager?.forEach(name => {
        if (typeof name === 'string') {
          const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
          properNames.set(slug, name)
        }
      })
      
      // Coaches
      team.coaches?.forEach(name => {
        if (typeof name === 'string') {
          const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
          properNames.set(slug, name)
        }
      })
      
      // Captain
      team.captain?.forEach(name => {
        if (typeof name === 'string') {
          const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
          properNames.set(slug, name)
        }
      })
      
      // Roster
      team.roster?.forEach(player => {
        if (player.name) {
          const slug = player.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
          properNames.set(slug, player.name)
        }
      })
      
      // Subs
      team.subs?.forEach(name => {
        if (typeof name === 'string') {
          const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
          properNames.set(slug, name)
        }
      })
    })
    
    // Get all people from database
    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      depth: 0,
    })
    
    const updates: any[] = []
    const skipped: any[] = []
    
    for (const person of allPeople.docs) {
      const properName = person.slug ? properNames.get(person.slug) : undefined
      
      if (properName && properName !== person.name) {
        // Update this person
        try {
          await payload.update({
            collection: 'people',
            id: person.id,
            data: {
              name: properName,
            },
          })
          
          updates.push({
            id: person.id,
            oldName: person.name,
            newName: properName,
            slug: person.slug,
          })
        } catch (error: any) {
          skipped.push({
            id: person.id,
            name: person.name,
            slug: person.slug,
            error: error.message,
          })
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      totalProperNames: properNames.size,
      updated: updates.length,
      skippedCount: skipped.length,
      updates,
      skipped,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
