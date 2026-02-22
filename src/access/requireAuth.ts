/**
 * Shared auth helper for API routes.
 * 
 * Verifies that the request comes from an authenticated admin or staff-manager user.
 * Returns the user and payload instance, or a 401 JSON response.
 * 
 * Usage:
 *   const auth = await requireAuth(request)
 *   if (auth instanceof NextResponse) return auth
 *   const { user, payload } = auth
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const ALLOWED_ROLES = ['admin', 'staff-manager']

export async function requireAuth(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers as any })

  if (!user || !ALLOWED_ROLES.includes(user.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { user, payload }
}
