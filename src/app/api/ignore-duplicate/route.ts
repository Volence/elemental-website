import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiErrorResponse, apiSuccessResponse } from '@/utilities/apiAuth'

/**
 * POST /api/ignore-duplicate
 * Mark two people as "not duplicates" so they stop appearing in duplicate checks
 * Only admins can ignore duplicates
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest()
    if (!authResult.success) {
      return authResult.response
    }

    const { payload, user } = authResult.data

    // Only admins can ignore duplicates
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { person1Id, person2Id } = body

    if (!person1Id || !person2Id) {
      return NextResponse.json(
        { success: false, error: 'Both person1Id and person2Id are required' },
        { status: 400 }
      )
    }

    // Check if this pair is already ignored
    const existing = await payload.find({
      collection: 'ignored-duplicates',
      where: {
        or: [
          {
            and: [
              { person1: { equals: person1Id } },
              { person2: { equals: person2Id } },
            ],
          },
          {
            and: [
              { person1: { equals: person2Id } },
              { person2: { equals: person1Id } },
            ],
          },
        ],
      },
    })

    if (existing.docs.length > 0) {
      return NextResponse.json(
        { success: false, error: 'This pair is already marked as not duplicates' },
        { status: 400 }
      )
    }

    // Create the ignored duplicate entry
    await payload.create({
      collection: 'ignored-duplicates',
      data: {
        person1: person1Id,
        person2: person2Id,
      },
    })

    return apiSuccessResponse({
      message: 'Successfully marked as not duplicates',
    })
  } catch (error) {
    console.error('Error ignoring duplicate:', error)
    return apiErrorResponse(error, 'Failed to ignore duplicate')
  }
}

