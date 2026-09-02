import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/utilities/apiAuth'
import { canPickMembers } from '@/identity/permissions'
import { getGuildGateway } from '@/identity/guild'
import { DISCORD_ID_RE } from '@/identity/config'
import { findPersonByDiscordId, createPersonFromDiscord } from '@/identity/people'
import { createAuditLog } from '@/utilities/auditLogger'

/**
 * Create (or return) the People row for a Discord member. The profile is fetched server-side,
 * never trusted from the client, and the member must be in a registered server.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { payload, user } = auth.data
  if (!canPickMembers(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const discordId = String(body?.discordId ?? '')
  if (!DISCORD_ID_RE.test(discordId)) return NextResponse.json({ error: 'Discord ID must be 17-19 digits' }, { status: 400 })

  const existing = await findPersonByDiscordId(payload, discordId)
  if (existing) return NextResponse.json({ person: { id: existing.id, name: existing.name }, created: false })

  const gateway = await getGuildGateway()
  const profile = await gateway.fetchProfile(discordId)
  if (!profile) return NextResponse.json({ error: 'Not a member of any Elemental server' }, { status: 404 })

  const person = await createPersonFromDiscord(payload, profile)
  await createAuditLog(payload, {
    user: user.id,
    action: 'create',
    collection: 'people',
    documentId: person.id,
    documentTitle: person.name,
    metadata: { identity: 'create-from-discord', discordId, by: user.id },
  })
  return NextResponse.json({ person: { id: person.id, name: person.name }, created: true })
}
