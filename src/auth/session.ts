import type { Payload } from 'payload'
import type { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { trackLogin } from '@/utilities/sessionTracker'

export const SESSION_COOKIE = 'payload-token'

export interface SqlExecutor {
  execute(query: any): Promise<any>
}

/**
 * Sessions are managed with raw SQL on purpose: payload.db.updateOne with partial data
 * delete-reinserts every hasMany select table on people (pugTiers, pugApprovedRoles, ...).
 */
export async function createSessionRow(
  db: SqlExecutor,
  personId: number,
  tokenExpirationSeconds: number,
  now: Date = new Date(),
): Promise<{ sid: string; expiresAt: Date }> {
  const sid = uuid()
  const expiresAt = new Date(now.getTime() + tokenExpirationSeconds * 1000)

  await db.execute(sql`DELETE FROM people_sessions WHERE _parent_id = ${personId} AND expires_at <= ${now}`)
  const nextOrder = await db.execute(
    sql`SELECT COALESCE(MAX(_order), 0) + 1 AS next_order FROM people_sessions WHERE _parent_id = ${personId}`,
  )
  const order = nextOrder?.rows?.[0]?.next_order ?? nextOrder?.[0]?.next_order ?? 1
  await db.execute(
    sql`INSERT INTO people_sessions (_order, _parent_id, id, created_at, expires_at) VALUES (${order}, ${personId}, ${sid}, ${now}, ${expiresAt})`,
  )
  return { sid, expiresAt }
}

/**
 * The only place that mints a payload-token for a person. Used by the Discord callback.
 * Also records the login in active-sessions so access review sees Discord logins.
 */
export async function issueSession(args: {
  payload: Payload
  person: { id: number; email?: string | null }
  response: NextResponse
  request?: NextRequest
}): Promise<NextResponse> {
  const { payload, person, response, request } = args
  const { jwtSign } = await import('payload')

  const collectionConfig = (payload as any).collections['people'].config
  const tokenExpiration: number = collectionConfig?.auth?.tokenExpiration || 60 * 60 * 24 * 7
  const useSessions = collectionConfig?.auth?.useSessions !== false

  const fieldsToSign: Record<string, any> = { id: person.id, email: person.email ?? null, collection: 'people' }

  if (useSessions) {
    const { sid } = await createSessionRow((payload as any).db.drizzle, person.id, tokenExpiration)
    fieldsToSign.sid = sid
  }

  const { token } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration })

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: tokenExpiration,
  })

  // Fire and forget: the tracker does its own error handling.
  const req: any = request ? { headers: request.headers } : undefined
  trackLogin(payload, person as any, req).catch((err) => console.error('[Session] trackLogin failed:', err))

  return response
}
