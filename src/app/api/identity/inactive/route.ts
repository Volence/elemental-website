import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { authenticateRequest } from '@/utilities/apiAuth'
import { createAuditLog } from '@/utilities/auditLogger'

const isReviewer = (u: any) => u?.role === 'admin' || u?.role === 'staff-manager'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  if (!isReviewer(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const personId = parseInt(body?.personId, 10)
  const inactive = body?.inactive === true
  if (!personId) return NextResponse.json({ error: 'personId required' }, { status: 400 })

  await (payload as any).db.drizzle.execute(sql`UPDATE people SET is_inactive = ${inactive} WHERE id = ${personId}`)
  await createAuditLog(payload, { user: user.id, action: 'update', collection: 'people', documentId: personId, metadata: { identity: 'set-inactive', inactive } })
  return NextResponse.json({ ok: true })
}
