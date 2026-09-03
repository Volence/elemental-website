import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { canRunSeed } from '@/utilities/seedGuard'
import { seedTeams } from '@/endpoints/seed/teams'

export const maxDuration = 300 // This function can run for up to 5 minutes (seeding can take time)

export async function POST(): Promise<Response> {
  const payload = await getPayload({ config })
  const requestHeaders = await headers()

  // Authenticate by passing request headers
  const { user } = await payload.auth({ headers: requestHeaders })

  // Seeding wipes data: admin-only, and never in production without ALLOW_DB_SEED=true.
  const guard = canRunSeed(user)
  if (!guard.ok) {
    return new Response(guard.reason, { status: guard.status })
  }
  if (!user) {
    return new Response('Action forbidden.', { status: 403 })
  }

  try {
    // Create a Payload request object to pass to the Local API for transactions
    const payloadReq = await createLocalReq({ user }, payload)

    // Clear existing teams and re-seed fresh
    await seedTeams({ payload, req: payloadReq, clearExisting: true })

    return Response.json({ 
      success: true,
      message: 'Database cleared and teams re-seeded successfully. All People entries have been created and Teams have been linked to them.'
    })
  } catch (e: any) {
    payload.logger.error({ err: e, message: 'Error seeding teams' })
    return Response.json(
      { 
        success: false,
        error: e.message || 'Error seeding teams data.'
      },
      { status: 500 }
    )
  }
}
