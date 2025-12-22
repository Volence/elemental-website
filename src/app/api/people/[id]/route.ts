import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { authenticateRequest, apiErrorResponse, apiSuccessResponse } from '@/utilities/apiAuth'

/**
 * DELETE /api/people/[id]
 * Delete a person from the database
 * Only admins can delete people
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request)
    if (!authResult.authenticated || !authResult.user) {
      return apiErrorResponse('Unauthorized', 401)
    }

    // Only admins can delete people
    if (authResult.user.role !== 'admin') {
      return apiErrorResponse('Forbidden: Admin access required', 403)
    }

    const { id } = await params
    const personId = parseInt(id, 10)

    if (isNaN(personId)) {
      return apiErrorResponse('Invalid person ID', 400)
    }

    const payload = await getPayload({ config })

    // Check if person exists
    const person = await payload.findByID({
      collection: 'people',
      id: personId,
    })

    if (!person) {
      return apiErrorResponse('Person not found', 404)
    }

    // Delete the person
    await payload.delete({
      collection: 'people',
      id: personId,
    })

    return apiSuccessResponse({
      message: `Successfully deleted person: ${person.name}`,
      deletedId: personId,
    })
  } catch (error) {
    console.error('Error deleting person:', error)
    return apiErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete person',
      500
    )
  }
}

