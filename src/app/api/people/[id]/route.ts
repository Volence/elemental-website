import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiErrorResponse, apiSuccessResponse } from '@/utilities/apiAuth'

/**
 * DELETE /api/people/[id]
 * Delete a person from the database
 * Only admins can delete people
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest()
    if (!authResult.success) {
      return authResult.response
    }

    const { payload, user } = authResult.data

    // Only admins can delete people
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Invalid person ID' },
        { status: 400 }
      )
    }

    // Check if person exists
    const person = await payload.findByID({
      collection: 'people',
      id,
    })

    if (!person) {
      return NextResponse.json(
        { success: false, error: 'Person not found' },
        { status: 404 }
      )
    }

    // Delete the person
    await payload.delete({
      collection: 'people',
      id,
    })

    return apiSuccessResponse({
      message: `Successfully deleted person: ${person.name}`,
      deletedId: id,
    })
  } catch (error) {
    console.error('Error deleting person:', error)
    return apiErrorResponse(error, 'Failed to delete person')
  }
}

