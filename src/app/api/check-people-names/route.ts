import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'

/**
 * API endpoint to check for people with missing or null names
 * Helps diagnose why people show as "Untitled" in relationship fields
 */
export async function GET(request: Request) {
  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    
    // Authenticate the request
    const { user } = await payload.auth({ headers: requestHeaders })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Fetch all people
    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      depth: 0,
    })
    
    // Check for people with null, undefined, or empty names
    const peopleWithMissingNames = allPeople.docs.filter((person: any) => {
      return !person.name || person.name.trim() === '' || person.name === null || person.name === undefined
    })
    
    // Get sample of people with names to verify they exist
    const peopleWithNames = allPeople.docs.filter((person: any) => {
      return person.name && person.name.trim() !== ''
    }).slice(0, 10)
    
    return NextResponse.json({
      totalPeople: allPeople.totalDocs,
      peopleWithNames: peopleWithNames.length,
      peopleWithMissingNames: peopleWithMissingNames.length,
      missingNamesDetails: peopleWithMissingNames.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),
      sampleWithNames: peopleWithNames.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API /api/check-people-names] Error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}




