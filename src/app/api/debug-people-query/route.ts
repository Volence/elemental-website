import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'

/**
 * Debug endpoint to check how Payload queries people for relationship fields
 * This simulates what Payload's REST API does when fetching relationship options
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
    
    // Simulate what Payload's relationship field does - it uses useAsTitle to select fields
    // But let's check what actually gets returned
    
    // Test 1: Basic find (what relationship fields use)
    const basicResult = await payload.find({
      collection: 'people',
      limit: 5,
      depth: 0,
    })
    
    // Test 2: Find with explicit select (simulating what useAsTitle should do)
    const selectedResult = await payload.find({
      collection: 'people',
      limit: 5,
      depth: 0,
      select: {
        id: true,
        name: true,
      },
    })
    
    // Test 3: Find by ID (like when displaying selected relationship)
    const id172 = await payload.findByID({
      collection: 'people',
      id: 172,
      depth: 0,
    })
    
    return NextResponse.json({
      basicQuery: {
        count: basicResult.docs.length,
        docs: basicResult.docs.map((p: any) => ({
          id: p.id,
          name: p.name,
          hasName: !!p.name,
          nameType: typeof p.name,
        })),
      },
      selectedQuery: {
        count: selectedResult.docs.length,
        docs: selectedResult.docs.map((p: any) => ({
          id: p.id,
          name: p.name,
          hasName: !!p.name,
          nameType: typeof p.name,
        })),
      },
      id172: {
        id: id172.id,
        name: id172.name,
        hasName: !!id172.name,
        nameType: typeof id172.name,
        fullDoc: id172,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API /api/debug-people-query] Error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}






