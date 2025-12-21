import { NextResponse } from 'next/server'
import { authenticateRequest, apiErrorResponse } from '@/utilities/apiAuth'

/**
 * API endpoint to check for people with missing or null names
 * Helps diagnose why people show as "Untitled" in relationship fields
 */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const { payload } = auth.data

  try {
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
    const peopleWithNames = allPeople.docs
      .filter((person: any) => {
        return person.name && person.name.trim() !== ''
      })
      .slice(0, 10)

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
    console.error('[API /api/check-people-names] Error:', error)
    return apiErrorResponse(error, 'Failed to check people names')
  }
}








