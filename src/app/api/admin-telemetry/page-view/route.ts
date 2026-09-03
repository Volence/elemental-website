import { NextRequest, NextResponse } from 'next/server'

import { authenticateRequest } from '@/utilities/apiAuth'
import { normalizeAdminPath, shouldTouchActivity } from '@/utilities/adminTelemetry'
import { touchActivity } from '@/utilities/sessionTracker'

// Per-process throttle so a busy admin does not write an active-sessions row on every view.
const lastTouchByPerson = new Map<number, number>()

/**
 * Record one admin page view for the signed-in person and, at most once per
 * throttle window, refresh their active-sessions lastActivity so Access Review's
 * "dormant" flag reflects real use of the admin rather than login events alone.
 *
 * Called from AdminProviders on every client-side navigation. Always answers
 * quickly and never fails the caller: telemetry must not break the admin.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const { payload, user } = auth.data

  let body: { path?: unknown } = {}
  try {
    body = (await request.json()) as { path?: unknown }
  } catch {
    // no body or not JSON: treat as an invalid path below
  }

  const path = normalizeAdminPath(body.path)
  if (!path) {
    return NextResponse.json({ success: false, error: 'path must be an /admin path' }, { status: 400 })
  }

  try {
    await payload.create({
      collection: 'admin-page-views',
      data: { person: user.id, path, role: (user as { role?: string | null }).role ?? null },
      overrideAccess: true,
    })
  } catch (error) {
    console.error('[AdminTelemetry] failed to record page view:', error)
  }

  const now = Date.now()
  if (shouldTouchActivity(lastTouchByPerson.get(user.id), now)) {
    lastTouchByPerson.set(user.id, now)
    // Fire and forget: the tracker does its own error handling.
    touchActivity(payload, user, { headers: request.headers } as never).catch((err) =>
      console.error('[AdminTelemetry] touchActivity failed:', err),
    )
  }

  return new NextResponse(null, { status: 204 })
}
