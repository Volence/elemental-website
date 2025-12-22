import { createLocalReq } from 'payload'
import { seedTeams } from '@/endpoints/seed/teams'
import { authenticateRequest, apiSuccessResponse, apiErrorResponse } from '@/utilities/apiAuth'

export const maxDuration = 300 // This function can run for up to 5 minutes (seeding can take time)

export async function POST(): Promise<Response> {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const { payload, user } = auth.data

  try {
    // Create a Payload request object to pass to the Local API for transactions
    const payloadReq = await createLocalReq({ user: { ...user, collection: 'users' } }, payload)

    await seedTeams({ payload, req: payloadReq })

    return apiSuccessResponse(
      null,
      'Teams seeded successfully. All People entries have been created and Teams have been linked to them.',
    )
  } catch (e: any) {
    payload.logger.error({ err: e, message: 'Error seeding teams' })
    return apiErrorResponse(e, 'Error seeding teams data.')
  }
}
