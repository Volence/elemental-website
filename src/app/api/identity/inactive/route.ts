import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { authenticateWithAccess, authError } from '@/utilities/apiAuth'
import { createAuditLog } from '@/utilities/auditLogger'

export async function POST(request: NextRequest) {
  const auth = await authenticateWithAccess()
  if (!auth.success) return auth.response
  const { payload, user, access } = auth.data
  if (!access.canManagePeople) return authError(403, 'Forbidden')

  const body = await request.json().catch(() => ({}))
  const personId = parseInt(body?.personId, 10)
  const inactive = body?.inactive === true
  if (!personId) return NextResponse.json({ error: 'personId required' }, { status: 400 })

  await (payload as any).db.drizzle.execute(sql`UPDATE people SET is_inactive = ${inactive} WHERE id = ${personId}`)
  await createAuditLog(payload, { user: user.id, action: 'update', collection: 'people', documentId: personId, metadata: { identity: 'set-inactive', inactive } })
  return NextResponse.json({ ok: true })
}
