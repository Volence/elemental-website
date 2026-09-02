import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { DISCORD_ID_RE } from '@/identity/config'
import { getGuildGateway } from '@/identity/guild'
import { findPersonByDiscordId, setDiscordIdentity } from '@/identity/people'
import { createAuditLog } from '@/utilities/auditLogger'

const isReviewer = (u: any) => u?.role === 'admin' || u?.role === 'staff-manager'

/** Attach a Discord ID to a legacy person. Conflicts are sent to the merge tool, never resolved here. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  if (!isReviewer(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const personId = parseInt(body?.personId, 10)
  const discordId = String(body?.discordId ?? '')
  if (!personId || !DISCORD_ID_RE.test(discordId)) return NextResponse.json({ error: 'personId and a 17-19 digit discordId are required' }, { status: 400 })

  const other = await findPersonByDiscordId(payload, discordId)
  if (other && other.id !== personId) {
    return NextResponse.json({ error: 'That Discord ID already belongs to another person', otherId: other.id, otherName: other.name }, { status: 409 })
  }

  const gateway = await getGuildGateway()
  const profile = await gateway.fetchProfile(discordId)
  if (!profile) return NextResponse.json({ error: 'Not a member of any Elemental server' }, { status: 404 })

  await setDiscordIdentity(payload, personId, profile)
  await (payload as any).db.drizzle.execute((await import('drizzle-orm')).sql`UPDATE people SET username = ${discordId} WHERE id = ${personId} AND username IS NULL`)
  const person: any = await payload.findByID({ collection: 'people', id: personId, depth: 0, overrideAccess: true })
  await createAuditLog(payload, {
    user: user.id,
    action: 'update',
    collection: 'people',
    documentId: personId,
    documentTitle: person?.name,
    metadata: { identity: 'admin-link', discordId, discordUsername: profile.username, by: user.id },
  })
  return NextResponse.json({ ok: true })
}
