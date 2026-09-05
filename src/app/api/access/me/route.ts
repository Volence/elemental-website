import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { resolveAccessForUser, serializeAccess } from '@/access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const access = await resolveAccessForUser(payload, user as any)
  return NextResponse.json(serializeAccess(access!), { headers: { 'Cache-Control': 'private, no-store' } })
}
