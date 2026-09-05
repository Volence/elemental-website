import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithAccess, authError } from '@/utilities/apiAuth'
import { getGuildGateway } from '@/identity/guild'
import { attachPeople } from '@/identity/memberLookup'

export async function GET(request: NextRequest) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  if (!auth.data.access.canPickMembers) return authError(403, 'Forbidden')

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const gateway = await getGuildGateway()
  const hits = await gateway.searchMembers(q, 20)
  const results = await attachPeople(auth.data.payload, hits)
  return NextResponse.json({ results })
}
