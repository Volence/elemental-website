import { checkDataConsistency } from '@/utilities/checkDataConsistency'
import { authenticateRequest, apiErrorResponse, apiSuccessResponse } from '@/utilities/apiAuth'

/**
 * API endpoint to check data consistency
 * 
 * Returns:
 * - Orphaned People (not linked to any team/staff)
 * - Teams with missing person relationships (legacy data)
 * - Duplicate People entries with similar names
 * 
 * Usage: GET /api/check-data-consistency
 * Requires authentication.
 */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const { payload } = auth.data

  try {
    const report = await checkDataConsistency(payload)
    return apiSuccessResponse(report)
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Failed to check data consistency')
  }
}
