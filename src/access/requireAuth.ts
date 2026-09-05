/**
 * Shared auth helper for API routes.
 *
 * Verifies that the request comes from an authenticated user whose resolved access clears the
 * requested gate. Default gate is staff-manager or above (`access.canManagePeople`); pass
 * `opts.department` to require a department instead (optionally at `opts.level`, default member).
 * Returns the user, payload, and resolved access, or a 401 JSON response.
 *
 * Usage:
 *   const auth = await requireAuth(request)
 *   if (auth instanceof NextResponse) return auth
 *   const { user, payload, access } = auth
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveAccessForUser, hasDepartment, type DepartmentKey, type Level } from '@/access'

export async function requireAuth(request: NextRequest, opts?: { department?: DepartmentKey; level?: Level }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers as any })

  const access = user ? await resolveAccessForUser(payload, user as any) : null
  if (!user || !access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = opts?.department
    ? hasDepartment(access, opts.department, opts.level ?? 'member')
    : access.canManagePeople

  if (!allowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { user, payload, access }
}
