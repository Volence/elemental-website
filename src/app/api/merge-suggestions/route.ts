import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'

async function getAdminWithDrizzle() {
  const payload = await getPayload({ config: configPromise })
  const reqHeaders = await headers()
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || (user as any).role !== 'admin') return null
  const drizzle = (payload as any).db?.drizzle
  if (!drizzle) return null
  const { sql } = await import('drizzle-orm')
  return { payload, drizzle, sql }
}

export async function GET() {
  const ctx = await getAdminWithDrizzle()
  if (!ctx) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  const { drizzle, sql } = ctx

  try {
    const result = await drizzle.execute(sql.raw(`
      SELECT ms.id, ms.similarity, ms.source, ms.created_at,
        ms.new_person_id, np.name as new_person_name,
        ms.existing_person_id, ep.name as existing_person_name
      FROM merge_suggestions ms
      LEFT JOIN people np ON np.id = ms.new_person_id
      LEFT JOIN people ep ON ep.id = ms.existing_person_id
      WHERE ms.status = 'pending'
      ORDER BY ms.created_at DESC
      LIMIT 100
    `))

    const rows = (result.rows ?? result) as any[]
    const suggestions = rows.map((r: any) => ({
      id: r.id,
      newPerson: { id: r.new_person_id, name: r.new_person_name },
      existingPerson: { id: r.existing_person_id, name: r.existing_person_name },
      similarity: Number(r.similarity),
      source: r.source,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ suggestions, total: suggestions.length })
  } catch (e: any) {
    if (e.message?.includes('does not exist')) {
      return NextResponse.json({ suggestions: [], total: 0 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAdminWithDrizzle()
  if (!ctx) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  const { drizzle, sql } = ctx

  const body = await request.json()
  const { id, status } = body
  if (!id || !['dismissed', 'merged'].includes(status)) {
    return NextResponse.json({ error: 'id and status (dismissed|merged) required' }, { status: 400 })
  }

  await drizzle.execute(sql.raw(
    `UPDATE merge_suggestions SET status = '${status}', updated_at = now() WHERE id = ${Number(id)}`
  ))

  return NextResponse.json({ success: true })
}
