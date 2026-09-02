import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { canPickMembers } from '@/identity/permissions'
import { getGuildGateway } from '@/identity/guild'
import { attachPeople } from '@/identity/memberLookup'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  if (!canPickMembers(auth.data.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const gateway = await getGuildGateway()
  const hits = await gateway.searchMembers(q, 20)
  const results = await attachPeople(auth.data.payload, hits)
  return NextResponse.json({ results })
}
